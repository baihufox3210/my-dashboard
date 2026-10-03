import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import {
  activityFile,
  analyticsFile,
  articlesFile,
  dataDirectory,
  friendsFile,
  homeProfileFile,
  projectsFile,
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
  type AnalyticsRow,
  type AnalyticsSource,
  type Article,
  type Friend,
  type HomeProfile,
  type Project,
  type SiteSettings,
} from './types.js'

let sessionWriteQueue: Promise<void> = Promise.resolve()
let analyticsWriteQueue: Promise<void> = Promise.resolve()
let activityWriteQueue: Promise<void> = Promise.resolve()

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

export async function ensureStorage(sessions: Map<string, number>) {
  await fs.mkdir(dataDirectory, { recursive: true })
  await fs.mkdir(uploadsDirectory, { recursive: true })

  const defaults: [string, string][] = [
    [articlesFile, '[]\n'],
    [projectsFile, '[]\n'],
    [siteSettingsFile, `${JSON.stringify(defaultSiteSettings, null, 2)}\n`],
    [homeProfileFile, `${JSON.stringify(defaultHomeProfile, null, 2)}\n`],
    [analyticsFile, '[]\n'],
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

export async function queuePageView(page: AnalyticsPage, device: AnalyticsDevice, articleId?: string, source?: AnalyticsSource) {
  const day = new Date().toISOString().slice(0, 10)
  const operation = analyticsWriteQueue.then(async () => {
    const rows = JSON.parse(await fs.readFile(analyticsFile, 'utf8')) as AnalyticsRow[]
    const existing = rows.find((row) => row.day === day && row.page === page && row.device === device && row.articleId === articleId && row.source === source)
    if (existing) existing.views += 1
    else rows.push({ day, page, device, views: 1, ...(articleId ? { articleId } : {}), ...(source ? { source } : {}) })
    const cutoff = new Date(Date.now() - 120 * 86_400_000).toISOString().slice(0, 10)
    const retained = rows.filter((row) => row.day >= cutoff)
    await writeJsonAtomically(analyticsFile, retained, { mode: 0o600 })
  })
  analyticsWriteQueue = operation.catch((error: unknown) => console.error('Could not save page view:', error))
  return operation
}

export async function waitForAnalyticsWrites() {
  await analyticsWriteQueue
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
