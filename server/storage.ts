import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import { DatabaseSync, type StatementSync } from 'node:sqlite'
import {
  activityFile,
  analyticsDatabaseFile,
  analyticsEventRetentionDays,
  analyticsLegacyFile,
  articlesFile,
  dataDirectory,
  friendsFile,
  homeProfileFile,
  projectsFile,
  musicFile,
  sessionsFile,
  siteSettingsFile,
  uploadsDirectory,
} from './config.js'
import {
  defaultHomeProfile,
  defaultSiteSettings,
  type ActivityEntry,
  type AnalyticsDevice,
  type AnalyticsPage,
  type AnalyticsRegion,
  type AnalyticsRow,
  type AnalyticsSource,
  type Article,
  type Friend,
  type HomeProfile,
  type Project,
  type MusicTrack,
  type SiteSettings,
} from './types.js'

let sessionWriteQueue: Promise<void> = Promise.resolve()
let analyticsWriteQueue: Promise<void> = Promise.resolve()
let activityWriteQueue: Promise<void> = Promise.resolve()
let analyticsDatabase: DatabaseSync | undefined
let lastAnalyticsPruneDay = ''
let pageViewStatements: { page: StatementSync; region: StatementSync; event: StatementSync } | undefined

export type PageViewInput = {
  page: AnalyticsPage
  device: AnalyticsDevice
  articleId?: string
  source?: AnalyticsSource
  region?: AnalyticsRegion | null
  ip: string
  sessionId?: string
  path?: string
  referrer?: string
  browser: string
  os: string
  userAgent: string
}

type AtomicWriteOptions = { mode?: number; pretty?: boolean }

// Parsed JSON keyed by file and validated against mtime/size, so repeated reads skip
// disk I/O and parsing while manual edits to data files are still picked up.
// Cached values are shared: readers below return copies and callers must not mutate items.
const jsonCache = new Map<string, { mtimeMs: number; size: number; value: unknown }>()

async function readJsonFile<T>(file: string, missing?: () => T): Promise<T> {
  let stat
  try {
    stat = await fs.stat(file)
  } catch (error) {
    if (missing && (error as NodeJS.ErrnoException).code === 'ENOENT') return missing()
    throw error
  }
  const cached = jsonCache.get(file)
  if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) return cached.value as T
  const value = JSON.parse(await fs.readFile(file, 'utf8')) as T
  jsonCache.set(file, { mtimeMs: stat.mtimeMs, size: stat.size, value })
  return value
}

export async function writeJsonAtomically(file: string, value: unknown, options: AtomicWriteOptions = {}) {
  const temporaryFile = `${file}.${crypto.randomUUID()}.tmp`
  const serialized = JSON.stringify(value, null, options.pretty ? 2 : undefined)
  try {
    await fs.writeFile(temporaryFile, `${serialized}\n`, {
      encoding: 'utf8',
      flag: 'wx',
      ...(options.mode === undefined ? {} : { mode: options.mode }),
    })
    await fs.rename(temporaryFile, file)
    jsonCache.delete(file)
    if (options.mode !== undefined) await fs.chmod(file, options.mode)
  } catch (error) {
    await fs.unlink(temporaryFile).catch(() => undefined)
    throw error
  }
}

export function persistSessions(sessions: Map<string, number>) {
  const operation = sessionWriteQueue.then(() => writeJsonAtomically(sessionsFile, [...sessions.entries()], { mode: 0o600 }))
  sessionWriteQueue = operation.catch((error: unknown) => console.error('Could not persist admin sessions:', error))
  return operation
}

async function initializeAnalyticsDatabase() {
  const database = new DatabaseSync(analyticsDatabaseFile)
  database.exec('PRAGMA busy_timeout = 5000; PRAGMA secure_delete = ON;')
  database.exec(`
    CREATE TABLE IF NOT EXISTS analytics_page_views (
      day TEXT NOT NULL CHECK(length(day) = 10),
      page TEXT NOT NULL,
      device TEXT NOT NULL,
      article_id TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT '',
      views INTEGER NOT NULL CHECK(views > 0),
      PRIMARY KEY (day, page, device, article_id, source)
    ) STRICT;
    CREATE INDEX IF NOT EXISTS analytics_page_views_day_idx ON analytics_page_views(day);
    CREATE TABLE IF NOT EXISTS analytics_region_views (
      day TEXT NOT NULL CHECK(length(day) = 10),
      country TEXT NOT NULL,
      region TEXT NOT NULL,
      views INTEGER NOT NULL CHECK(views > 0),
      PRIMARY KEY (day, country, region)
    ) STRICT;
    CREATE INDEX IF NOT EXISTS analytics_region_views_day_idx ON analytics_region_views(day);
    CREATE TABLE IF NOT EXISTS analytics_events (
      id INTEGER PRIMARY KEY,
      at TEXT NOT NULL,
      day TEXT NOT NULL CHECK(length(day) = 10),
      ip TEXT NOT NULL,
      session_id TEXT NOT NULL DEFAULT '',
      page TEXT NOT NULL,
      path TEXT NOT NULL DEFAULT '',
      article_id TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT '',
      referrer TEXT NOT NULL DEFAULT '',
      device TEXT NOT NULL,
      browser TEXT NOT NULL DEFAULT '',
      os TEXT NOT NULL DEFAULT '',
      country TEXT NOT NULL DEFAULT '',
      region TEXT NOT NULL DEFAULT '',
      city TEXT NOT NULL DEFAULT '',
      user_agent TEXT NOT NULL DEFAULT ''
    ) STRICT;
    CREATE INDEX IF NOT EXISTS analytics_events_day_idx ON analytics_events(day);
    CREATE INDEX IF NOT EXISTS analytics_events_ip_idx ON analytics_events(ip, id);
    CREATE TABLE IF NOT EXISTS storage_metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    ) STRICT;
  `)

  const eventColumns = database.prepare('PRAGMA table_info(analytics_events)').all() as Array<{ name: string }>
  if (!eventColumns.some((column) => column.name === 'city')) database.exec("ALTER TABLE analytics_events ADD COLUMN city TEXT NOT NULL DEFAULT ''")

  const oldVisitorTable = database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get('analytics_visitors')
  if (oldVisitorTable) database.exec('DROP TABLE analytics_visitors;')
  const analyticsCutoff = new Date(Date.now() - 120 * 86_400_000).toISOString().slice(0, 10)
  database.prepare('DELETE FROM analytics_region_views WHERE day < ?').run(analyticsCutoff)

  const migration = database.prepare('SELECT value FROM storage_metadata WHERE key = ?').get('analytics_json_migrated') as { value?: string } | undefined
  if (migration?.value !== '1') {
    let legacyRows: unknown = []
    try {
      legacyRows = JSON.parse(await fs.readFile(analyticsLegacyFile, 'utf8')) as unknown
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }

    const insert = database.prepare(`
      INSERT INTO analytics_page_views (day, page, device, article_id, source, views)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(day, page, device, article_id, source)
      DO UPDATE SET views = analytics_page_views.views + excluded.views
    `)
    database.exec('BEGIN')
    try {
      if (Array.isArray(legacyRows)) {
        for (const value of legacyRows) {
          if (!value || typeof value !== 'object') continue
          const row = value as Partial<AnalyticsRow>
          if (typeof row.day !== 'string' || typeof row.page !== 'string' || typeof row.device !== 'string' || typeof row.views !== 'number' || !Number.isInteger(row.views) || row.views <= 0) continue
          insert.run(row.day, row.page, row.device, row.articleId ?? '', row.source ?? '', row.views)
        }
      }
      database.prepare('INSERT OR REPLACE INTO storage_metadata (key, value) VALUES (?, ?)').run('analytics_json_migrated', '1')
      database.exec('COMMIT')
    } catch (error) {
      database.exec('ROLLBACK')
      throw error
    }

    await fs.unlink(analyticsLegacyFile).catch((error: unknown) => {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    })
  }

  await fs.chmod(analyticsDatabaseFile, 0o600)
  analyticsDatabase = database
}

function getAnalyticsDatabase() {
  if (!analyticsDatabase) throw new Error('Analytics database is not initialized.')
  return analyticsDatabase
}

export async function ensureStorage(sessions: Map<string, number>) {
  await fs.mkdir(dataDirectory, { recursive: true })
  await fs.mkdir(uploadsDirectory, { recursive: true })
  await initializeAnalyticsDatabase()

  const defaults: [string, string][] = [
    [articlesFile, '[]\n'],
    [projectsFile, '[]\n'],
    [musicFile, '[]\n'],
    [siteSettingsFile, `${JSON.stringify(defaultSiteSettings, null, 2)}\n`],
    [homeProfileFile, `${JSON.stringify(defaultHomeProfile, null, 2)}\n`],
    [activityFile, '[]\n'],
  ]
  await Promise.all(defaults.map(async ([file, initialValue]) => {
    try {
      await fs.access(file)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      await fs.writeFile(file, initialValue, { encoding: 'utf8', flag: 'wx' }).catch(async (writeError: unknown) => {
        if ((writeError as NodeJS.ErrnoException).code !== 'EEXIST') throw writeError
      })
    }
  }))

  try {
    const savedSessions = JSON.parse(await fs.readFile(sessionsFile, 'utf8')) as unknown
    if (Array.isArray(savedSessions)) {
      for (const entry of savedSessions) {
        if (!Array.isArray(entry)) continue
        const [sessionHash, expiresAt] = entry as [unknown, unknown]
        if (typeof sessionHash === 'string' && /^[a-f0-9]{64}$/.test(sessionHash) && typeof expiresAt === 'number' && expiresAt > Date.now()) {
          sessions.set(sessionHash, expiresAt)
        }
      }
    }
    await persistSessions(sessions)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
}

export type ArticleSummary = Omit<Article, 'content'> & { excerpt: string; wordCount: number }

const articleSummaryCache = new WeakMap<Article[], ArticleSummary[]>()

function countWords(content: string) {
  return content.trim() ? content.trim().split(/\s+/u).length : 0
}

function articleExcerpt(content: string) {
  return content
    .replace(/\|\|[\s\S]+?\|\|/g, '▒▒▒')
    .replace(/[#*`>_[\]!~]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200)
}

export function summarizeArticle({ content, ...article }: Article): ArticleSummary {
  return { ...article, excerpt: articleExcerpt(content), wordCount: countWords(content) }
}

const loadArticles = () => readJsonFile<Article[]>(articlesFile)

export async function readArticles(): Promise<Article[]> {
  return [...await loadArticles()]
}

// Newest first, without article bodies; recomputed only when the articles file changes.
export async function readArticleSummaries(): Promise<ArticleSummary[]> {
  const articles = await loadArticles()
  let summaries = articleSummaryCache.get(articles)
  if (!summaries) {
    summaries = articles.map(summarizeArticle).sort((first, second) => second.publishedAt.localeCompare(first.publishedAt))
    articleSummaryCache.set(articles, summaries)
  }
  return summaries
}

export async function writeArticles(articles: Article[]) {
  await writeJsonAtomically(articlesFile, articles, { pretty: true })
}

export async function readFriends(): Promise<Friend[]> {
  return [...await readJsonFile<Friend[]>(friendsFile, () => [])]
}

export async function writeFriends(friends: Friend[]) {
  await writeJsonAtomically(friendsFile, friends, { pretty: true })
}

export async function readProjects(): Promise<Project[]> {
  return [...await readJsonFile<Project[]>(projectsFile, () => [])]
}

export async function writeProjects(projects: Project[]) {
  await writeJsonAtomically(projectsFile, projects, { pretty: true })
}

function repairMojibake(value: string) {
  if (!/[ÃÂæåçèé]/.test(value)) return value
  try {
    const repaired = Buffer.from(value, 'latin1').toString('utf8')
    return repaired.includes('�') ? value : repaired
  } catch {
    return value
  }
}

function normalizeMusicTrack(track: MusicTrack): MusicTrack {
  return {
    ...track,
    ...(typeof track.title === 'string' ? { title: repairMojibake(track.title) } : {}),
    ...(typeof track.fileName === 'string' ? { fileName: repairMojibake(track.fileName) } : {}),
  }
}

export async function readMusicTracks(): Promise<MusicTrack[]> {
  const tracks = await readJsonFile<MusicTrack[]>(musicFile, () => [])
  return tracks.filter((track) => track && typeof track.id === 'string' && typeof track.fileUrl === 'string').map(normalizeMusicTrack).sort((first, second) => first.order - second.order)
}

export async function writeMusicTracks(tracks: MusicTrack[]) {
  await writeJsonAtomically(musicFile, tracks, { pretty: true })
}

export async function readSiteSettings(): Promise<SiteSettings> {
  const settings = await readJsonFile<Partial<SiteSettings>>(siteSettingsFile)
  return {
    ...defaultSiteSettings,
    ...settings,
    backgroundPositionX: settings.backgroundPositionX ?? 50,
    backgroundPositionY: settings.backgroundPositionY ?? 50,
  }
}

export async function writeSiteSettings(settings: SiteSettings) {
  await writeJsonAtomically(siteSettingsFile, settings, { pretty: true })
}

export async function readHomeProfile(): Promise<HomeProfile> {
  return { ...defaultHomeProfile, ...await readJsonFile<Partial<HomeProfile>>(homeProfileFile) }
}

export async function writeHomeProfile(profile: HomeProfile) {
  await writeJsonAtomically(homeProfileFile, profile, { pretty: true })
}

// Every view updates the long-lived daily aggregates and appends one detailed event row.
export async function queuePageView(view: PageViewInput) {
  const { page, device, articleId, source, region } = view
  const at = new Date().toISOString()
  const day = at.slice(0, 10)
  const operation = analyticsWriteQueue.then(() => {
    const database = getAnalyticsDatabase()
    pageViewStatements ??= {
      page: database.prepare(`
        INSERT INTO analytics_page_views (day, page, device, article_id, source, views)
        VALUES (?, ?, ?, ?, ?, 1)
        ON CONFLICT(day, page, device, article_id, source)
        DO UPDATE SET views = analytics_page_views.views + 1
      `),
      region: database.prepare(`
        INSERT INTO analytics_region_views (day, country, region, views)
        VALUES (?, ?, ?, 1)
        ON CONFLICT(day, country, region)
        DO UPDATE SET views = analytics_region_views.views + 1
      `),
      event: database.prepare(`
        INSERT INTO analytics_events (at, day, ip, session_id, page, path, article_id, source, referrer, device, browser, os, country, region, city, user_agent)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `),
    }
    database.exec('BEGIN')
    try {
      pageViewStatements.page.run(day, page, device, articleId ?? '', source ?? '')
      if (region) pageViewStatements.region.run(day, region.country, region.region || '未細分')
      pageViewStatements.event.run(
        at, day, view.ip, view.sessionId ?? '', page, view.path ?? '', articleId ?? '', source ?? '', view.referrer ?? '',
        device, view.browser, view.os, region?.country ?? '', region?.region ?? '', region?.city ?? '', view.userAgent,
      )
      if (lastAnalyticsPruneDay !== day) {
        const cutoff = new Date(Date.now() - 120 * 86_400_000).toISOString().slice(0, 10)
        database.prepare('DELETE FROM analytics_page_views WHERE day < ?').run(cutoff)
        database.prepare('DELETE FROM analytics_region_views WHERE day < ?').run(cutoff)
        const eventCutoff = new Date(Date.now() - analyticsEventRetentionDays * 86_400_000).toISOString().slice(0, 10)
        database.prepare('DELETE FROM analytics_events WHERE day < ?').run(eventCutoff)
      }
      database.exec('COMMIT')
      lastAnalyticsPruneDay = day
    } catch (error) {
      database.exec('ROLLBACK')
      throw error
    }
  })
  analyticsWriteQueue = operation.catch((error: unknown) => console.error('Could not save page view:', error))
  return operation
}

export async function waitForAnalyticsWrites() {
  await analyticsWriteQueue
}

export async function readAnalyticsRegionStats(startDay: string, endDay: string) {
  const database = getAnalyticsDatabase()
  const totals = database.prepare(`
    SELECT country, region, SUM(views) AS views
    FROM analytics_region_views
    WHERE day >= ? AND day <= ?
    GROUP BY country, region
    ORDER BY views DESC, country ASC, region ASC
    LIMIT 10
  `).all(startDay, endDay) as Array<{ country: string; region: string; views: number }>
  const count = database.prepare(`
    SELECT COUNT(*) AS regions
    FROM (
      SELECT country, region
      FROM analytics_region_views
      WHERE day >= ? AND day <= ?
      GROUP BY country, region
    )
  `).get(startDay, endDay) as { regions?: number }
  return { regionCount: count.regions ?? 0, topRegions: totals }
}

// Aggregates page views for [startDay, endDay] in SQLite and counts views in [previousStartDay, startDay).
export async function readAnalyticsTotals(startDay: string, endDay: string, previousStartDay: string) {
  const database = getAnalyticsDatabase()
  const range = [startDay, endDay] as const
  const grouped = <T>(column: string) => database.prepare(`
    SELECT ${column} AS key, SUM(views) AS views
    FROM analytics_page_views
    WHERE day >= ? AND day <= ?
    GROUP BY ${column}
  `).all(...range) as Array<{ key: T; views: number }>
  const previous = database.prepare('SELECT SUM(views) AS views FROM analytics_page_views WHERE day >= ? AND day < ?').get(previousStartDay, startDay) as { views: number | null }
  const topArticles = database.prepare(`
    SELECT article_id AS key, SUM(views) AS views
    FROM analytics_page_views
    WHERE day >= ? AND day <= ? AND article_id != ''
    GROUP BY article_id
    ORDER BY views DESC
    LIMIT 10
  `).all(...range) as Array<{ key: string; views: number }>
  return {
    daily: grouped<string>('day'),
    pages: grouped<AnalyticsPage>('page'),
    devices: grouped<AnalyticsDevice>('device'),
    sources: grouped<AnalyticsSource | ''>('source'),
    topArticles,
    previousViews: previous.views ?? 0,
  }
}

export type AnalyticsVisit = {
  id: number; at: string; ip: string; sessionId: string; page: AnalyticsPage; path: string; articleId: string
  source: string; referrer: string; device: AnalyticsDevice; browser: string; os: string; country: string; region: string; city: string; userAgent: string
}

// Visitor-level breakdowns for [startDay, endDay], computed from the per-view event log.
export async function readAnalyticsDetails(startDay: string, endDay: string) {
  const database = getAnalyticsDatabase()
  const range = [startDay, endDay] as const
  const summary = database.prepare(`
    SELECT COUNT(*) AS views, COUNT(DISTINCT ip) AS visitors,
      COUNT(DISTINCT CASE WHEN session_id != '' THEN session_id END) AS sessions
    FROM analytics_events WHERE day >= ? AND day <= ?
  `).get(...range) as { views: number; visitors: number; sessions: number }
  const returning = database.prepare(`
    SELECT COUNT(*) AS visitors FROM (
      SELECT ip FROM analytics_events WHERE day >= ? AND day <= ? GROUP BY ip HAVING COUNT(DISTINCT day) > 1
    )
  `).get(...range) as { visitors: number }
  const grouped = (column: string, limit = 10) => database.prepare(`
    SELECT ${column} AS key, COUNT(*) AS views
    FROM analytics_events
    WHERE day >= ? AND day <= ? AND ${column} != ''
    GROUP BY ${column}
    ORDER BY views DESC, key ASC
    LIMIT ${limit}
  `).all(...range) as Array<{ key: string; views: number }>
  const hourly = database.prepare(`
    SELECT CAST(strftime('%H', at) AS INTEGER) AS hour, COUNT(*) AS views
    FROM analytics_events WHERE day >= ? AND day <= ?
    GROUP BY hour
  `).all(...range) as Array<{ hour: number; views: number }>
  // SQLite returns the other bare columns from the row holding MAX(at), i.e. the latest visit.
  const topIps = database.prepare(`
    SELECT ip, COUNT(*) AS views, COUNT(DISTINCT CASE WHEN session_id != '' THEN session_id END) AS sessions,
      COUNT(DISTINCT day) AS days, MIN(at) AS firstSeen, MAX(at) AS lastSeen,
      country, region, city, device, browser, os
    FROM analytics_events WHERE day >= ? AND day <= ?
    GROUP BY ip
    ORDER BY views DESC, lastSeen DESC
    LIMIT 50
  `).all(...range) as Array<{ ip: string; views: number; sessions: number; days: number; firstSeen: string; lastSeen: string; country: string; region: string; city: string; device: string; browser: string; os: string }>
  const since = database.prepare('SELECT MIN(at) AS at FROM analytics_events').get() as { at: string | null }
  // Two levels of location detail: county/state, then township/city within it.
  const locations = (columns: string) => database.prepare(`
    SELECT ${columns}, COUNT(*) AS views, COUNT(DISTINCT ip) AS visitors
    FROM analytics_events
    WHERE day >= ? AND day <= ? AND country != ''
    GROUP BY ${columns}
    ORDER BY views DESC
    LIMIT 20
  `).all(...range) as Array<{ country: string; region: string; city?: string; views: number; visitors: number }>

  const hourlyUtc = Array.from({ length: 24 }, () => 0)
  for (const { hour, views } of hourly) hourlyUtc[hour] = views
  return {
    trackedViews: summary.views,
    uniqueVisitors: summary.visitors,
    sessions: summary.sessions,
    returningVisitors: returning.visitors,
    hourlyUtc,
    browsers: grouped('browser'),
    operatingSystems: grouped('os'),
    referrers: grouped('referrer'),
    topPaths: grouped('path'),
    topIps,
    regionLocations: locations('country, region'),
    cityLocations: locations('country, region, city'),
    eventsSince: since.at,
  }
}

// Newest visits first; `before` is the id of the last row already shown.
export async function readAnalyticsVisits({ ip, before, limit }: { ip?: string; before?: number; limit: number }) {
  const database = getAnalyticsDatabase()
  const conditions = ['1 = 1']
  const parameters: Array<string | number> = []
  if (ip) { conditions.push('ip = ?'); parameters.push(ip) }
  if (before) { conditions.push('id < ?'); parameters.push(before) }
  return database.prepare(`
    SELECT id, at, ip, session_id AS sessionId, page, path, article_id AS articleId, source, referrer,
      device, browser, os, country, region, city, user_agent AS userAgent
    FROM analytics_events
    WHERE ${conditions.join(' AND ')}
    ORDER BY id DESC
    LIMIT ?
  `).all(...parameters, limit) as AnalyticsVisit[]
}

export function recordActivity(entry: ActivityEntry) {
  const operation = activityWriteQueue.then(async () => {
    const entries = JSON.parse(await fs.readFile(activityFile, 'utf8')) as ActivityEntry[]
    entries.unshift(entry)
    await writeJsonAtomically(activityFile, entries.slice(0, 50), { mode: 0o600, pretty: true })
  })
  activityWriteQueue = operation.catch((error: unknown) => console.error('Could not save admin activity:', error))
  return activityWriteQueue
}

export async function waitForActivityWrites() {
  await activityWriteQueue
}
