import cookieParser from 'cookie-parser'
import crypto from 'node:crypto'
import express from 'express'
import fs from 'node:fs/promises'
import multer from 'multer'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import 'dotenv/config'

const currentFile = fileURLToPath(import.meta.url)
const currentDirectory = path.dirname(currentFile)
const projectDirectory = path.resolve(currentDirectory, '..')
const dataDirectory = path.join(projectDirectory, 'data')
const articlesFile = path.join(dataDirectory, 'articles.json')
const siteSettingsFile = path.join(dataDirectory, 'site-settings.json')
const homeProfileFile = path.join(dataDirectory, 'home-profile.json')
const sessionsFile = path.join(dataDirectory, 'admin-sessions.json')
const analyticsFile = path.join(dataDirectory, 'analytics.json')
const activityFile = path.join(dataDirectory, 'admin-activity.json')
const friendsFile = path.join(dataDirectory, 'friends.json')
const projectsFile = path.join(dataDirectory, 'projects.json')
const uploadsDirectory = path.join(projectDirectory, 'public', 'uploads')
const sessionLifetimeMs = 24 * 60 * 60 * 1000
const sessions = new Map<string, number>()
const loginFailures = new Map<string, { count: number; windowStarted: number; blockedUntil: number }>()
const analyticsRateLimits = new Map<string, { count: number; windowStarted: number }>()
type AnalyticsPage = 'home' | 'about' | 'projects' | 'blog' | 'article' | 'contact' | 'friends'
type AnalyticsDevice = 'mobile' | 'tablet' | 'desktop'
type AnalyticsSource = 'direct' | 'search' | 'social' | 'referral'
type AnalyticsRow = { day: string; page: AnalyticsPage; device: AnalyticsDevice; views: number; articleId?: string; source?: AnalyticsSource }
type ActivityEntry = { at: string; type: 'article' | 'homepage' | 'site'; action: 'published' | 'updated' | 'deleted' | 'saved'; title: string }
let analyticsWriteQueue: Promise<void> = Promise.resolve()
let activityWriteQueue: Promise<void> = Promise.resolve()
const port = Number(process.env.PORT ?? 3001)
const host = process.env.API_HOST ?? '127.0.0.1'
const trustedProxyIp = process.env.TRUSTED_PROXY_IP
const adminUsername = process.env.ADMIN_USERNAME
const adminPassword = process.env.ADMIN_PASSWORD
const siteStartDate = process.env.SITE_START_DATE ?? new Date().toISOString()

if (!adminUsername || !adminPassword || adminPassword.length < 8 || adminUsername === 'admin' || adminPassword === 'change-me') {
  throw new Error('Set ADMIN_USERNAME and a unique ADMIN_PASSWORD of at least 8 characters before starting the server.')
}

type Article = {
  id: string
  title: string
  content: string
  category: string
  tags: string[]
  coverImage?: string
  publishedAt: string
  updatedAt?: string
}

type SiteSettings = {
  siteName: string
  biography: string
  experience: string
  avatarUrl?: string
  backgroundUrl?: string
  backgroundPositionX?: number
  backgroundPositionY?: number
}

type HomeProfile = {
  name: string
  introduction: string
  quote: string
  avatarUrl?: string
  socials: { name: string; url: string }[]
  tags: string[]
  avatarMessages: string[]
  updateTitle: string
  updateText: string
}

type Friend = { id: string; name: string; introduction: string; url: string; avatarUrl?: string }
type Project = { id: string; title: string; summary: string; description: string; category: string; tags: string[]; projectUrl: string; coverImage?: string; documentUrl?: string; publishedAt: string; updatedAt?: string }

const defaultHomeProfile: HomeProfile = {
  name: 'baihu',
  introduction: '喜歡動手做，也喜歡把有趣的想法變成作品。',
  quote: 'Stay curious, keep building.',
  socials: [
    { name: 'Instagram', url: 'https://www.instagram.com/baihu3210' },
    { name: 'Discord', url: 'https://discord.com/users/808972376619483137' },
    { name: 'GitHub', url: 'https://github.com/baihufox3210' },
  ],
  tags: [],
  avatarMessages: ['嗨，歡迎來逛逛！ (｡•̀ᴗ-)✧', '今天也要保持好奇心！ (ง •̀_•́)ง', '謝謝你來看我的網站～ (´▽`ʃ♡ƪ)'],
  updateTitle: '最近在做什麼',
  updateText: '目前專注在機器人、程式與新點子的實作。',
}

const defaultSiteSettings: SiteSettings = {
  siteName: 'Baihu Personal Website',
  biography: '',
  experience: '',
}

const upload = multer({
  dest: uploadsDirectory,
  limits: { fileSize: 8 * 1024 * 1024, files: 2, fields: 20, fieldSize: 1024 * 1024 },
  fileFilter: (_request, file, callback) => {
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.mimetype)) {
      callback(new Error('Unsupported image type.'))
      return
    }
    callback(null, true)
  },
})
const projectUpload = multer({
  storage: multer.diskStorage({
    destination: uploadsDirectory,
    filename: (_request, file, callback) => {
      const extension = file.mimetype === 'application/pdf' ? '.pdf'
        : file.mimetype === 'image/jpeg' ? '.jpg'
          : file.mimetype === 'image/png' ? '.png'
            : file.mimetype === 'image/webp' ? '.webp' : '.gif'
      callback(null, `${crypto.randomUUID()}${extension}`)
    },
  }),
  limits: { fileSize: 25 * 1024 * 1024, files: 2, fields: 20, fieldSize: 1024 * 1024 },
  fileFilter: (_request, file, callback) => {
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'].includes(file.mimetype)) {
      callback(new Error('Unsupported project file type.'))
      return
    }
    callback(null, true)
  },
})

async function validateProjectFiles(request: express.Request, response: express.Response, next: express.NextFunction) {
  const files = request.files as { coverImage?: Express.Multer.File[]; document?: Express.Multer.File[] } | undefined
  const cover = files?.coverImage?.[0]
  const document = files?.document?.[0]
  const removeInvalid = async (message: string) => {
    await removeProjectUploads([cover, document].filter((file): file is Express.Multer.File => Boolean(file)))
    response.status(400).json({ message })
  }
  if (cover) {
    if (cover.size > 8 * 1024 * 1024) { await removeInvalid('封面圖片請限制在 8 MB 以內。'); return }
    const header = await fs.readFile(cover.path).then((buffer) => buffer.subarray(0, 12)).catch(() => Buffer.alloc(0))
    const valid = (header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) || header.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) || (header.toString('ascii', 0, 4) === 'RIFF' && header.toString('ascii', 8, 12) === 'WEBP') || header.toString('ascii', 0, 3) === 'GIF'
    if (!valid) { await removeInvalid('封面必須是有效的 JPEG、PNG、WebP 或 GIF 圖片。'); return }
  }
  if (document) {
    const header = await fs.readFile(document.path).then((buffer) => buffer.subarray(0, 5).toString('ascii')).catch(() => '')
    if (header !== '%PDF-') { await removeInvalid('文件必須是有效的 PDF。'); return }
  }
  next()
}

async function removeProjectUploads(files: Express.Multer.File[] = []) {
  await Promise.all(files.map((file) => fs.unlink(file.path).catch(() => undefined)))
}

async function removeProjectAssets(...urls: (string | undefined)[]) {
  const projects = await readProjects()
  const referencedAssets = new Set(projects.flatMap((project) => [project.coverImage, project.documentUrl].filter((url): url is string => Boolean(url))))
  const files = urls.flatMap((url) => {
    if (!url?.startsWith('/uploads/') || referencedAssets.has(url)) return []
    const filename = path.basename(url)
    if (!filename || filename !== url.slice('/uploads/'.length)) return []
    return [path.join(uploadsDirectory, filename)]
  })
  await Promise.all(files.map((file) => fs.unlink(file).catch((error: unknown) => {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  })))
}

async function validateUploadedImages(
  request: express.Request,
  response: express.Response,
  next: express.NextFunction,
) {
  const files = [
    ...(request.file ? [request.file] : []),
    ...(Array.isArray(request.files) ? request.files : Object.values(request.files ?? {}).flat()),
  ]
  for (const file of files) {
    const header = await fs.readFile(file.path).then((buffer) => buffer.subarray(0, 12)).catch(() => Buffer.alloc(0))
    const valid =
      (header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) ||
      (header.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
      (header.toString('ascii', 0, 4) === 'RIFF' && header.toString('ascii', 8, 12) === 'WEBP') ||
      (header.toString('ascii', 0, 3) === 'GIF')
    if (!valid) {
      await Promise.all(files.map((uploaded) => fs.unlink(uploaded.path).catch(() => undefined)))
      response.status(400).json({ message: 'Only valid JPEG, PNG, WebP, or GIF images are accepted.' })
      return
    }
  }
  next()
}

function boundedText(value: unknown, maxLength: number) {
  return typeof value === 'string' && value.length <= maxLength
}

function isSafeSocialUrl(value: string) {
  try {
    const parsed = new URL(value)
    return (parsed.protocol === 'https:' || parsed.protocol === 'http:') && value.length <= 2048
  } catch {
    return false
  }
}

async function ensureStorage() {
  await fs.mkdir(dataDirectory, { recursive: true })
  await fs.mkdir(uploadsDirectory, { recursive: true })

  try {
    await fs.access(articlesFile)
  } catch {
    await fs.writeFile(articlesFile, '[]\n', 'utf8')
  }

  try { await fs.access(projectsFile) }
  catch { await fs.writeFile(projectsFile, '[]\n', 'utf8') }

  try {
    await fs.access(siteSettingsFile)
  } catch {
    await fs.writeFile(siteSettingsFile, `${JSON.stringify(defaultSiteSettings, null, 2)}\n`, 'utf8')
  }

  try {
    await fs.access(homeProfileFile)
  } catch {
    await fs.writeFile(homeProfileFile, `${JSON.stringify(defaultHomeProfile, null, 2)}\n`, 'utf8')
  }

  try {
    await fs.access(analyticsFile)
  } catch {
    await fs.writeFile(analyticsFile, '[]\n', 'utf8')
  }
  try {
    await fs.access(activityFile)
  } catch {
    await fs.writeFile(activityFile, '[]\n', 'utf8')
  }

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
    await persistSessions()
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
}

async function readArticles(): Promise<Article[]> {
  const content = await fs.readFile(articlesFile, 'utf8')
  return JSON.parse(content) as Article[]
}

async function writeArticles(articles: Article[]) {
  await fs.writeFile(articlesFile, `${JSON.stringify(articles, null, 2)}\n`, 'utf8')
}

async function readFriends(): Promise<Friend[]> {
  try { return JSON.parse(await fs.readFile(friendsFile, 'utf8')) as Friend[] }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error }
}

async function writeFriends(friends: Friend[]) {
  await fs.writeFile(friendsFile, `${JSON.stringify(friends, null, 2)}\n`, 'utf8')
}

async function readProjects(): Promise<Project[]> {
  try { return JSON.parse(await fs.readFile(projectsFile, 'utf8')) as Project[] }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error }
}

async function writeProjects(projects: Project[]) {
  await fs.writeFile(projectsFile, `${JSON.stringify(projects, null, 2)}\n`, 'utf8')
}

async function readSiteSettings(): Promise<SiteSettings> {
  const content = await fs.readFile(siteSettingsFile, 'utf8')
  const settings = JSON.parse(content) as Partial<SiteSettings>
  return {
    ...defaultSiteSettings,
    ...settings,
    backgroundPositionX: settings.backgroundPositionX ?? 50,
    backgroundPositionY: settings.backgroundPositionY ?? 50,
  }
}

async function writeSiteSettings(settings: SiteSettings) {
  await fs.writeFile(siteSettingsFile, `${JSON.stringify(settings, null, 2)}\n`, 'utf8')
}

function hashSessionId(sessionId: string) {
  return crypto.createHash('sha256').update(sessionId).digest('hex')
}

async function persistSessions() {
  const temporaryFile = `${sessionsFile}.${crypto.randomUUID()}.tmp`
  try {
    await fs.writeFile(temporaryFile, `${JSON.stringify([...sessions.entries()])}\n`, { encoding: 'utf8', mode: 0o600, flag: 'wx' })
    await fs.rename(temporaryFile, sessionsFile)
    await fs.chmod(sessionsFile, 0o600)
  } catch (error) {
    await fs.unlink(temporaryFile).catch(() => undefined)
    throw error
  }
}

async function readHomeProfile(): Promise<HomeProfile> {
  const content = await fs.readFile(homeProfileFile, 'utf8')
  return { ...defaultHomeProfile, ...(JSON.parse(content) as Partial<HomeProfile>) }
}

function isAuthenticated(request: express.Request) {
  const sessionId = request.cookies.admin_session as string | undefined
  if (!sessionId) return false
  const sessionHash = hashSessionId(sessionId)
  const expiresAt = sessions.get(sessionHash)
  if (!expiresAt) return false
  if (expiresAt <= Date.now()) {
    sessions.delete(sessionHash)
    void persistSessions().catch((error: unknown) => console.error('Could not persist admin sessions:', error))
    return false
  }
  return true
}

function getClientIp(request: express.Request) {
  const remoteAddress = request.socket.remoteAddress ?? 'unknown'
  const isTrustedProxy = trustedProxyIp && (
    remoteAddress === trustedProxyIp || remoteAddress === `::ffff:${trustedProxyIp}`
  )
  return isTrustedProxy ? request.get('x-real-ip') || remoteAddress : remoteAddress
}

function requireSameOrigin(request: express.Request, response: express.Response, next: express.NextFunction) {
  const origin = request.get('origin')
  const remoteAddress = request.socket.remoteAddress ?? ''
  const localProxy = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remoteAddress)
  const configuredProxy = trustedProxyIp && (remoteAddress === trustedProxyIp || remoteAddress === `::ffff:${trustedProxyIp}`)
  const forwardedHost = localProxy || configuredProxy ? request.get('x-forwarded-host')?.split(',')[0]?.trim() : undefined
  const host = forwardedHost || request.get('host')
  try {
    if (!origin || !host || new URL(origin).host !== host) throw new Error('Origin mismatch')
  } catch {
    response.status(403).json({ message: 'Request origin is not allowed.' })
    return
  }
  next()
}

function requireAuthentication(
  request: express.Request,
  response: express.Response,
  next: express.NextFunction,
) {
  if (!isAuthenticated(request)) {
    response.status(401).json({ message: 'Authentication required.' })
    return
  }

  next()
}

function countWords(content: string) {
  return content.trim() ? content.trim().split(/\s+/u).length : 0
}

function queuePageView(page: AnalyticsPage, device: AnalyticsDevice, articleId?: string, source?: AnalyticsSource) {
  const day = new Date().toISOString().slice(0, 10)
  const operation = analyticsWriteQueue.then(async () => {
    const rows = JSON.parse(await fs.readFile(analyticsFile, 'utf8')) as AnalyticsRow[]
    const existing = rows.find((row) => row.day === day && row.page === page && row.device === device && row.articleId === articleId && row.source === source)
    if (existing) existing.views += 1
    else rows.push({ day, page, device, views: 1, ...(articleId ? { articleId } : {}), ...(source ? { source } : {}) })
    const cutoff = new Date(Date.now() - 120 * 86_400_000).toISOString().slice(0, 10)
    const retained = rows.filter((row) => row.day >= cutoff)
    const temporaryFile = `${analyticsFile}.${crypto.randomUUID()}.tmp`
    await fs.writeFile(temporaryFile, `${JSON.stringify(retained)}\n`, { encoding: 'utf8', mode: 0o600, flag: 'wx' })
    await fs.rename(temporaryFile, analyticsFile)
  })
  analyticsWriteQueue = operation.catch((error: unknown) => console.error('Could not save page view:', error))
  return operation
}

function recordActivity(entry: ActivityEntry) {
  const operation = activityWriteQueue.then(async () => {
    const entries = JSON.parse(await fs.readFile(activityFile, 'utf8')) as ActivityEntry[]
    entries.unshift(entry)
    const temporaryFile = `${activityFile}.${crypto.randomUUID()}.tmp`
    await fs.writeFile(temporaryFile, `${JSON.stringify(entries.slice(0, 50), null, 2)}\n`, { encoding: 'utf8', mode: 0o600, flag: 'wx' })
    await fs.rename(temporaryFile, activityFile)
  })
  activityWriteQueue = operation.catch((error: unknown) => console.error('Could not save admin activity:', error))
  return activityWriteQueue
}

function getAnalyticsDevice(userAgent: string): AnalyticsDevice {
  if (/ipad|tablet/i.test(userAgent)) return 'tablet'
  if (/mobile|iphone|ipod|android/i.test(userAgent)) return 'mobile'
  return 'desktop'
}

setInterval(() => {
  const now = Date.now()
  let removed = false
  for (const [sessionId, expiresAt] of sessions) {
    if (expiresAt <= now) { sessions.delete(sessionId); removed = true }
  }
  if (removed) void persistSessions().catch((error: unknown) => console.error('Could not persist admin sessions:', error))
}, 60 * 60 * 1000).unref()

function daysSince(dateString: string) {
  const start = new Date(dateString).getTime()
  return Math.max(0, Math.floor((Date.now() - start) / 86_400_000))
}

const app = express()
app.disable('x-powered-by')
app.use((_request, response, next) => {
  response.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none';",
  })
  next()
})
app.use(express.json({ limit: '1mb' }))
app.use(cookieParser())
app.use('/uploads', express.static(uploadsDirectory))

app.get('/api/auth/me', (request, response) => {
  response.json({ authenticated: isAuthenticated(request) })
})

app.get('/api/site-settings', async (_request, response) => {
  response.json(await readSiteSettings())
})

app.get('/api/home-profile', async (_request, response) => {
  response.json(await readHomeProfile())
})

app.get('/api/friends', async (_request, response) => response.json(await readFriends()))

app.get('/api/projects', async (_request, response) => {
  const projects = await readProjects()
  response.json(projects.sort((first, second) => second.publishedAt.localeCompare(first.publishedAt)))
})

const receiveProjectFiles = projectUpload.fields([{ name: 'coverImage', maxCount: 1 }, { name: 'document', maxCount: 1 }])
app.post('/api/admin/projects', requireSameOrigin, requireAuthentication, receiveProjectFiles, validateProjectFiles, async (request, response) => {
  const body = request.body as { title?: string; summary?: string; description?: string; category?: string; tags?: string; projectUrl?: string }
  const { title, summary, description, category, tags, projectUrl } = body
  if (!title?.trim() || !boundedText(title, 160) || !boundedText(summary ?? '', 500) || !boundedText(description ?? '', 100_000) || !boundedText(category ?? '', 80) || !boundedText(tags ?? '', 2000) || !boundedText(projectUrl ?? '', 2048) || (projectUrl?.trim() && !isSafeSocialUrl(projectUrl.trim()))) {
    await removeProjectUploads(Object.values(request.files ?? {}).flat())
    response.status(400).json({ message: '專案標題、內容或連結格式不正確，或超過字數限制。' }); return
  }
  const files = request.files as { coverImage?: Express.Multer.File[]; document?: Express.Multer.File[] } | undefined
  const now = new Date().toISOString()
  const project: Project = {
    id: crypto.randomUUID(), title: title.trim(), summary: summary?.trim() ?? '', description: description?.trim() ?? '', category: category?.trim() ?? '',
    tags: (tags ?? '').split(',').map((tag) => tag.trim()).filter(Boolean), projectUrl: projectUrl?.trim() ?? '',
    ...(files?.coverImage?.[0] ? { coverImage: `/uploads/${files.coverImage[0].filename}` } : {}),
    ...(files?.document?.[0] ? { documentUrl: `/uploads/${files.document[0].filename}` } : {}), publishedAt: now, updatedAt: now,
  }
  const uploadedFiles = Object.values(request.files ?? {}).flat()
  try { await writeProjects([project, ...await readProjects()]) }
  catch (error) { await removeProjectUploads(uploadedFiles); throw error }
  response.status(201).json(project)
})

app.put('/api/admin/projects/:id', requireSameOrigin, requireAuthentication, receiveProjectFiles, validateProjectFiles, async (request, response) => {
  const files = request.files as { coverImage?: Express.Multer.File[]; document?: Express.Multer.File[] } | undefined
  const projects = await readProjects()
  const index = projects.findIndex((project) => project.id === request.params.id)
  if (index < 0) {
    await removeProjectUploads(Object.values(request.files ?? {}).flat())
    response.status(404).json({ message: '找不到這個專案。' }); return
  }
  const existing = projects[index]
  if (!existing) { response.status(404).json({ message: '找不到這個專案。' }); return }
  const body = request.body as { title?: string; summary?: string; description?: string; category?: string; tags?: string; projectUrl?: string; removeDocument?: string }
  const { title, summary, description, category, tags, projectUrl } = body
  if (!title?.trim() || !boundedText(title, 160) || !boundedText(summary ?? '', 500) || !boundedText(description ?? '', 100_000) || !boundedText(category ?? '', 80) || !boundedText(tags ?? '', 2000) || !boundedText(projectUrl ?? '', 2048) || (projectUrl?.trim() && !isSafeSocialUrl(projectUrl.trim()))) {
    await removeProjectUploads(Object.values(request.files ?? {}).flat())
    response.status(400).json({ message: '專案標題、內容或連結格式不正確，或超過字數限制。' }); return
  }
  const oldCover = existing.coverImage
  const oldDocument = existing.documentUrl
  projects[index] = {
    ...existing, title: title.trim(), summary: summary?.trim() ?? '', description: description?.trim() ?? '', category: category?.trim() ?? '',
    tags: (tags ?? '').split(',').map((tag) => tag.trim()).filter(Boolean), projectUrl: projectUrl?.trim() ?? '', updatedAt: new Date().toISOString(),
    ...(files?.coverImage?.[0] ? { coverImage: `/uploads/${files.coverImage[0].filename}` } : {}),
    ...(files?.document?.[0] ? { documentUrl: `/uploads/${files.document[0].filename}` } : body.removeDocument === 'true' ? { documentUrl: undefined } : {}),
  }
  try { await writeProjects(projects) }
  catch (error) { await removeProjectUploads(Object.values(request.files ?? {}).flat()); throw error }
  await removeProjectAssets(
    files?.coverImage?.[0] ? oldCover : undefined,
    files?.document?.[0] || body.removeDocument === 'true' ? oldDocument : undefined,
  )
  response.json(projects[index])
})

app.delete('/api/admin/projects/:id', requireSameOrigin, requireAuthentication, async (request, response) => {
  const projects = await readProjects()
  const project = projects.find((item) => item.id === request.params.id)
  if (!project) { response.status(404).json({ message: '找不到這個專案。' }); return }
  await writeProjects(projects.filter((item) => item.id !== request.params.id))
  await removeProjectAssets(project.coverImage, project.documentUrl)
  response.status(204).end()
})

app.post('/api/admin/friends', requireSameOrigin, requireAuthentication, upload.single('avatar'), validateUploadedImages, async (request, response) => {
  const { name, introduction, url } = request.body as { name?: string; introduction?: string; url?: string }
  if (!name?.trim() || !boundedText(name, 120) || !boundedText(introduction ?? '', 1000) || !url || !isSafeSocialUrl(url)) {
    response.status(400).json({ message: '朋友名稱、自介或連結格式不正確。' }); return
  }
  const friend: Friend = { id: crypto.randomUUID(), name: name.trim(), introduction: introduction?.trim() ?? '', url: url.trim(), ...(request.file ? { avatarUrl: `/uploads/${request.file.filename}` } : {}) }
  const friends = await readFriends(); friends.push(friend); await writeFriends(friends); response.status(201).json(friend)
})

app.put('/api/admin/friends/:id', requireSameOrigin, requireAuthentication, upload.single('avatar'), validateUploadedImages, async (request, response) => {
  const { name, introduction, url } = request.body as { name?: string; introduction?: string; url?: string }
  if (!name?.trim() || !boundedText(name, 120) || !boundedText(introduction ?? '', 1000) || !url || !isSafeSocialUrl(url)) {
    response.status(400).json({ message: '朋友名稱、自介或連結格式不正確。' }); return
  }
  const friends = await readFriends(); const index = friends.findIndex((item) => item.id === request.params.id)
  if (index < 0) { response.status(404).json({ message: '找不到這位朋友。' }); return }
  const existing = friends[index]
  if (!existing) { response.status(404).json({ message: '找不到這位朋友。' }); return }
  const updated: Friend = { ...existing, name: name.trim(), introduction: introduction?.trim() ?? '', url: url.trim(), ...(request.file ? { avatarUrl: `/uploads/${request.file.filename}` } : {}) }
  friends[index] = updated; await writeFriends(friends); response.json(updated)
})

app.delete('/api/admin/friends/:id', requireSameOrigin, requireAuthentication, async (request, response) => {
  const friends = await readFriends()
  const remaining = friends.filter((friend) => friend.id !== request.params.id)
  if (remaining.length === friends.length) { response.status(404).json({ message: '找不到這位朋友。' }); return }
  await writeFriends(remaining)
  response.status(204).end()
})

app.post('/api/auth/login', requireSameOrigin, async (request, response) => {
  const ip = getClientIp(request)
  let failure = loginFailures.get(ip)
  if (failure && Date.now() - failure.windowStarted > 15 * 60_000 && failure.blockedUntil <= Date.now()) {
    loginFailures.delete(ip)
    failure = undefined
  }
  if (failure && failure.blockedUntil > Date.now()) {
    response.set('Retry-After', String(Math.ceil((failure.blockedUntil - Date.now()) / 1000)))
    response.status(429).json({ message: 'Too many login attempts. Try again later.' })
    return
  }
  const { username, password } = request.body as { username?: string; password?: string }

  if (username !== adminUsername || password !== adminPassword) {
    const nextCount = (failure?.count ?? 0) + 1
    const now = Date.now()
    for (const [key, value] of loginFailures) {
      if (value.windowStarted + 15 * 60_000 < now && value.blockedUntil <= now) loginFailures.delete(key)
    }
    if (!loginFailures.has(ip) && loginFailures.size >= 5000) {
      const oldestKey = loginFailures.keys().next().value
      if (oldestKey) loginFailures.delete(oldestKey)
    }
    loginFailures.set(ip, {
      count: nextCount,
      windowStarted: failure?.windowStarted ?? now,
      blockedUntil: nextCount >= 5 ? now + 15 * 60_000 : 0,
    })
    response.status(401).json({ message: 'Invalid username or password.' })
    return
  }
  loginFailures.delete(ip)

  const sessionId = crypto.randomBytes(32).toString('hex')
  const now = Date.now()
  for (const [sessionHash, expiresAt] of sessions) {
    if (expiresAt <= now) sessions.delete(sessionHash)
  }
  sessions.set(hashSessionId(sessionId), now + sessionLifetimeMs)
  await persistSessions()
  response.cookie('admin_session', sessionId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: request.get('origin')?.startsWith('https://') === true,
    path: '/',
    maxAge: sessionLifetimeMs,
  })
  response.json({ authenticated: true })
})

app.post('/api/auth/logout', requireSameOrigin, async (request, response) => {
  const sessionId = request.cookies.admin_session as string | undefined
  if (sessionId) sessions.delete(hashSessionId(sessionId))
  await persistSessions()
  response.clearCookie('admin_session')
  response.json({ authenticated: false })
})

app.get('/api/articles', async (_request, response) => {
  const articles = await readArticles()
  response.json(articles.sort((first, second) => second.publishedAt.localeCompare(first.publishedAt)))
})

app.post('/api/analytics/view', requireSameOrigin, async (request, response) => {
  const clientKey = getClientIp(request)
  const now = Date.now()
  const limit = analyticsRateLimits.get(clientKey)
  if (limit && now - limit.windowStarted < 60_000 && limit.count >= 60) {
    response.status(429).json({ message: 'Too many page view events.' })
    return
  }
  if (!limit || now - limit.windowStarted >= 60_000) analyticsRateLimits.set(clientKey, { count: 1, windowStarted: now })
  else limit.count += 1
  if (analyticsRateLimits.size > 10_000) {
    for (const [key, value] of analyticsRateLimits) if (now - value.windowStarted >= 60_000) analyticsRateLimits.delete(key)
  }

  const page = request.body?.page as AnalyticsPage
  const pages: AnalyticsPage[] = ['home', 'about', 'projects', 'blog', 'article', 'contact', 'friends']
  if (!pages.includes(page)) {
    response.status(400).json({ message: 'Invalid page.' })
    return
  }
  const articleId = typeof request.body?.articleId === 'string' ? request.body.articleId : undefined
  if (page === 'article' && (!articleId || articleId.length > 80)) {
    response.status(400).json({ message: 'Article views require a valid article ID.' })
    return
  }
  if (articleId) {
    const articles = await readArticles()
    if (!articles.some((article) => article.id === articleId)) {
      response.status(404).json({ message: 'Article not found.' })
      return
    }
  }
  const source = request.body?.source as AnalyticsSource | undefined
  const sources: AnalyticsSource[] = ['direct', 'search', 'social', 'referral']
  if (source !== undefined && !sources.includes(source)) {
    response.status(400).json({ message: 'Invalid traffic source.' })
    return
  }
  const device = getAnalyticsDevice(request.get('user-agent') ?? '')
  try {
    await queuePageView(page, device, articleId, source)
    response.status(204).end()
  } catch {
    response.status(500).json({ message: 'Could not record page view.' })
  }
})

app.get('/api/admin/analytics', requireAuthentication, async (request, response) => {
  await analyticsWriteQueue
  const days = request.query.days === '7' ? 7 : 30
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const currentStart = new Date(today.getTime() - (days - 1) * 86_400_000)
  const previousStart = new Date(currentStart.getTime() - days * 86_400_000)
  const currentStartDay = currentStart.toISOString().slice(0, 10)
  const previousStartDay = previousStart.toISOString().slice(0, 10)
  const todayDay = today.toISOString().slice(0, 10)
  const rows = JSON.parse(await fs.readFile(analyticsFile, 'utf8')) as AnalyticsRow[]
  const pageTotals = new Map<AnalyticsPage, number>()
  const articleTotals = new Map<string, number>()
  const sourceTotals: Record<AnalyticsSource, number> = { direct: 0, search: 0, social: 0, referral: 0 }
  const deviceTotals: Record<AnalyticsDevice, number> = { mobile: 0, tablet: 0, desktop: 0 }
  const dailyTotals = new Map<string, number>()
  let totalViews = 0
  let previousViews = 0
  for (const row of rows) {
    if (row.day >= currentStartDay && row.day <= todayDay) {
      totalViews += row.views
      dailyTotals.set(row.day, (dailyTotals.get(row.day) ?? 0) + row.views)
      pageTotals.set(row.page, (pageTotals.get(row.page) ?? 0) + row.views)
      deviceTotals[row.device] += row.views
      if (row.articleId) articleTotals.set(row.articleId, (articleTotals.get(row.articleId) ?? 0) + row.views)
      if (row.source) sourceTotals[row.source] += row.views
    } else if (row.day >= previousStartDay && row.day < currentStartDay) previousViews += row.views
  }
  const labels: Record<AnalyticsPage, string> = { home: '首頁', about: '關於', projects: '作品', blog: 'Blog', article: '文章閱讀', contact: '聯絡', friends: '友站' }
  const daily = Array.from({ length: days }, (_unused, index) => {
    const date = new Date(currentStart.getTime() + index * 86_400_000)
    const day = date.toISOString().slice(0, 10)
    return { day, views: dailyTotals.get(day) ?? 0 }
  })
  const topPages = [...pageTotals.entries()].map(([page, views]) => ({ page, label: labels[page], views })).sort((first, second) => second.views - first.views)
  const articles = await readArticles()
  const articleById = new Map(articles.map((article) => [article.id, article]))
  const topArticles = [...articleTotals.entries()].map(([id, views]) => {
    const article = articleById.get(id)
    return { id, title: article?.title ?? '已刪除文章', views }
  }).sort((first, second) => second.views - first.views).slice(0, 10)
  response.json({ days, totalViews, previousViews, daily, topPages, topArticles, sources: sourceTotals, devices: deviceTotals })
})

app.get('/api/admin/activity', requireAuthentication, async (_request, response) => {
  await activityWriteQueue
  response.json(JSON.parse(await fs.readFile(activityFile, 'utf8')) as ActivityEntry[])
})

app.get('/api/stats', async (_request, response) => {
  const articles = await readArticles()
  const tags = new Set(articles.flatMap((article) => article.tags))
  const categories = new Set(articles.map((article) => article.category).filter(Boolean))
  const totalWords = articles.reduce((total, article) => total + countWords(article.content), 0)
  const latestArticle = [...articles].sort((first, second) => second.publishedAt.localeCompare(first.publishedAt))[0]

  response.json({
    articleCount: articles.length,
    categoryCount: categories.size,
    tagCount: tags.size,
    totalWords,
    runtimeDays: daysSince(siteStartDate),
    lastActivity: latestArticle?.publishedAt ?? null,
  })
})

app.put(
  '/api/admin/site-settings',
  requireSameOrigin,
  requireAuthentication,
  upload.fields([
    { name: 'avatar', maxCount: 1 },
    { name: 'background', maxCount: 1 },
  ]),
  validateUploadedImages,
  async (request, response) => {
    const files = request.files as { avatar?: Express.Multer.File[]; background?: Express.Multer.File[] } | undefined
    const existingSettings = await readSiteSettings()
    const { siteName, biography, experience, backgroundPositionX, backgroundPositionY } = request.body as {
      siteName?: string
      biography?: string
      experience?: string
      backgroundPositionX?: string
      backgroundPositionY?: string
    }
    const position = (value: string | undefined, fallback: number) => {
      const parsed = Number(value)
      return Number.isFinite(parsed) ? Math.max(0, Math.min(100, parsed)) : fallback
    }

    const updatedSettings: SiteSettings = {
      ...existingSettings,
      siteName: siteName?.trim() || defaultSiteSettings.siteName,
      biography: biography?.trim() || '',
      experience: experience?.trim() || '',
      backgroundPositionX: position(backgroundPositionX, existingSettings.backgroundPositionX ?? 50),
      backgroundPositionY: position(backgroundPositionY, existingSettings.backgroundPositionY ?? 50),
      ...(files?.avatar?.[0] ? { avatarUrl: `/uploads/${files.avatar[0].filename}` } : {}),
      ...(files?.background?.[0] ? { backgroundUrl: `/uploads/${files.background[0].filename}` } : {}),
    }

    await writeSiteSettings(updatedSettings)
    await recordActivity({ at: new Date().toISOString(), type: 'site', action: 'saved', title: '網站設定' })
    response.json(updatedSettings)
  },
)

app.put('/api/admin/home-profile', requireSameOrigin, requireAuthentication, upload.single('avatar'), validateUploadedImages, async (request, response) => {
  const existing = await readHomeProfile()
  const body = request.body as Partial<Record<keyof HomeProfile, string>>
  let socials: HomeProfile['socials']
  let tags: string[]
  let avatarMessages: string[]
  try {
    socials = JSON.parse(body.socials ?? '[]') as HomeProfile['socials']
    tags = JSON.parse(body.tags ?? '[]') as string[]
    avatarMessages = JSON.parse(body.avatarMessages ?? '[]') as string[]
  } catch {
    response.status(400).json({ message: 'Social links and tags must be valid JSON.' })
    return
  }
  if (!Array.isArray(socials) || socials.length > 20 || !socials.every((item) => item && boundedText(item.name, 80) && boundedText(item.url, 2048) && isSafeSocialUrl(item.url))) {
    response.status(400).json({ message: 'Social links are invalid.' })
    return
  }
  if (!Array.isArray(tags) || tags.length > 50 || !tags.every((tag) => boundedText(tag, 80))) {
    response.status(400).json({ message: 'Tags are invalid.' })
    return
  }
  if (!Array.isArray(avatarMessages) || avatarMessages.length > 20 || !avatarMessages.every((message) => typeof message === 'string' && message.length <= 160)) {
    response.status(400).json({ message: 'Avatar messages are invalid.' })
    return
  }
  const updated: HomeProfile = {
    name: body.name?.trim() || defaultHomeProfile.name,
    introduction: body.introduction?.trim() ?? '',
    quote: body.quote?.trim() ?? '',
    socials: socials.map(({ name, url }) => ({ name: name.trim(), url: url.trim() })).filter(({ name, url }) => name && url),
    tags: tags.map((tag) => tag.trim()).filter(Boolean),
    avatarMessages: avatarMessages.map((message) => message.trim()).filter(Boolean),
    updateTitle: body.updateTitle?.trim() || defaultHomeProfile.updateTitle,
    updateText: body.updateText?.trim() ?? '',
    ...(request.file ? { avatarUrl: `/uploads/${request.file.filename}` } : existing.avatarUrl ? { avatarUrl: existing.avatarUrl } : {}),
  }
  await fs.writeFile(homeProfileFile, `${JSON.stringify(updated, null, 2)}\n`, 'utf8')
  await recordActivity({ at: new Date().toISOString(), type: 'homepage', action: 'saved', title: '首頁個人介紹' })
  response.json(updated)
})

app.post('/api/articles', requireSameOrigin, requireAuthentication, upload.single('coverImage'), validateUploadedImages, async (request, response) => {
  const { title, content, category, tags } = request.body as {
    title?: string
    content?: string
    category?: string
    tags?: string
  }

  if (!title?.trim() || !content?.trim() || title.length > 200 || content.length > 500_000 || (category?.length ?? 0) > 100 || (tags?.length ?? 0) > 2000) {
    response.status(400).json({ message: 'Title, content, category, or tags are invalid or too long.' })
    return
  }

  const article: Article = {
    id: crypto.randomUUID(),
    title: title.trim(),
    content,
    category: category?.trim() || 'Uncategorized',
    tags: (tags ?? '')
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean),
    ...(request.file ? { coverImage: `/uploads/${request.file.filename}` } : {}),
    publishedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  const articles = await readArticles()
  await writeArticles([article, ...articles])
  await recordActivity({ at: new Date().toISOString(), type: 'article', action: 'published', title: article.title })
  response.status(201).json(article)
})

app.put('/api/articles/:id', requireSameOrigin, requireAuthentication, upload.single('coverImage'), validateUploadedImages, async (request, response) => {
  const articles = await readArticles()
  const articleIndex = articles.findIndex((article) => article.id === request.params.id)

  if (articleIndex === -1) {
    response.status(404).json({ message: 'Article not found.' })
    return
  }

  const { title, content, category, tags } = request.body as {
    title?: string
    content?: string
    category?: string
    tags?: string
  }

  if (!title?.trim() || !content?.trim() || title.length > 200 || content.length > 500_000 || (category?.length ?? 0) > 100 || (tags?.length ?? 0) > 2000) {
    response.status(400).json({ message: 'Title, content, category, or tags are invalid or too long.' })
    return
  }

  const existingArticle = articles[articleIndex]
  const updatedArticle: Article = {
    ...existingArticle,
    title: title.trim(),
    content,
    category: category?.trim() || 'Uncategorized',
    tags: (tags ?? '').split(',').map((tag) => tag.trim()).filter(Boolean),
    updatedAt: new Date().toISOString(),
    ...(request.file ? { coverImage: `/uploads/${request.file.filename}` } : {}),
  }

  articles[articleIndex] = updatedArticle
  await writeArticles(articles)
  await recordActivity({ at: new Date().toISOString(), type: 'article', action: 'updated', title: updatedArticle.title })
  response.json(updatedArticle)
})

app.delete('/api/articles/:id', requireSameOrigin, requireAuthentication, async (request, response) => {
  const articles = await readArticles()
  const article = articles.find((entry) => entry.id === request.params.id)

  if (!article) {
    response.status(404).json({ message: 'Article not found.' })
    return
  }

  await writeArticles(articles.filter((entry) => entry.id !== request.params.id))
  await recordActivity({ at: new Date().toISOString(), type: 'article', action: 'deleted', title: article.title })
  response.status(204).end()
})

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  void _next
  if (error instanceof multer.MulterError || (error instanceof Error && ['Unsupported image type.', 'Unsupported project file type.'].includes(error.message))) {
    response.status(error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ message: '上傳失敗：圖片需為有效圖片且小於 8 MB，PDF 須小於 25 MB。' })
    return
  }
  console.error('Unhandled API error:', error)
  response.status(500).json({ message: 'Internal server error.' })
})

ensureStorage().then(() => {
  const server = app.listen(port, host, (error?: Error) => {
    if (error) {
      console.error('API server failed to listen:', error)
      process.exitCode = 1
      return
    }
    console.log(`API server listening on http://localhost:${port}`)
  })
  server.ref()
})
