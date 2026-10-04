import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import { DatabaseSync } from 'node:sqlite'
import {
  activityFile,
  analyticsDatabaseFile,
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

type AtomicWriteOptions = { mode?: number; pretty?: boolean }

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
    CREATE TABLE IF NOT EXISTS storage_metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    ) STRICT;
  `)

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

export async function readArticles(): Promise<Article[]> {
  return JSON.parse(await fs.readFile(articlesFile, 'utf8')) as Article[]
}

export async function writeArticles(articles: Article[]) {
  await writeJsonAtomically(articlesFile, articles, { pretty: true })
}

export async function readFriends(): Promise<Friend[]> {
  try { return JSON.parse(await fs.readFile(friendsFile, 'utf8')) as Friend[] }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error }
}

export async function writeFriends(friends: Friend[]) {
  await writeJsonAtomically(friendsFile, friends, { pretty: true })
}

export async function readProjects(): Promise<Project[]> {
  try { return JSON.parse(await fs.readFile(projectsFile, 'utf8')) as Project[] }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error }
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
  try {
    const tracks = JSON.parse(await fs.readFile(musicFile, 'utf8')) as MusicTrack[]
    return tracks.filter((track) => track && typeof track.id === 'string' && typeof track.fileUrl === 'string').map(normalizeMusicTrack).sort((first, second) => first.order - second.order)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
}

export async function writeMusicTracks(tracks: MusicTrack[]) {
  await writeJsonAtomically(musicFile, tracks, { pretty: true })
}

export async function readSiteSettings(): Promise<SiteSettings> {
  const settings = JSON.parse(await fs.readFile(siteSettingsFile, 'utf8')) as Partial<SiteSettings>
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
  return { ...defaultHomeProfile, ...(JSON.parse(await fs.readFile(homeProfileFile, 'utf8')) as Partial<HomeProfile>) }
}

export async function writeHomeProfile(profile: HomeProfile) {
  await writeJsonAtomically(homeProfileFile, profile, { pretty: true })
}

export async function queuePageView(page: AnalyticsPage, device: AnalyticsDevice, articleId?: string, source?: AnalyticsSource, region?: AnalyticsRegion | null) {
  const day = new Date().toISOString().slice(0, 10)
  const operation = analyticsWriteQueue.then(() => {
    const database = getAnalyticsDatabase()
    database.exec('BEGIN')
    try {
      database.prepare(`
        INSERT INTO analytics_page_views (day, page, device, article_id, source, views)
        VALUES (?, ?, ?, ?, ?, 1)
        ON CONFLICT(day, page, device, article_id, source)
        DO UPDATE SET views = analytics_page_views.views + 1
      `).run(day, page, device, articleId ?? '', source ?? '')
      if (region) {
        database.prepare(`
          INSERT INTO analytics_region_views (day, country, region, views)
          VALUES (?, ?, ?, 1)
          ON CONFLICT(day, country, region)
          DO UPDATE SET views = analytics_region_views.views + 1
        `).run(day, region.country, region.region)
      }
      const cutoff = new Date(Date.now() - 120 * 86_400_000).toISOString().slice(0, 10)
      database.prepare('DELETE FROM analytics_page_views WHERE day < ?').run(cutoff)
      database.prepare('DELETE FROM analytics_region_views WHERE day < ?').run(cutoff)
      database.exec('COMMIT')
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

export async function readAnalyticsRows(): Promise<AnalyticsRow[]> {
  const rows = getAnalyticsDatabase().prepare(`
    SELECT day, page, device, article_id, source, views
    FROM analytics_page_views
    ORDER BY day ASC
  `).all() as Array<{ day: string; page: AnalyticsPage; device: AnalyticsDevice; article_id: string; source: AnalyticsSource; views: number }>
  return rows.map((row) => ({
    day: row.day,
    page: row.page,
    device: row.device,
    views: row.views,
    ...(row.article_id ? { articleId: row.article_id } : {}),
    ...(row.source ? { source: row.source } : {}),
  }))
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
