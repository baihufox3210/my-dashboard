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
const uploadsDirectory = path.join(projectDirectory, 'public', 'uploads')
const sessionLifetimeMs = 24 * 60 * 60 * 1000
const sessions = new Map<string, number>()
const loginFailures = new Map<string, { count: number; windowStarted: number; blockedUntil: number }>()
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
}

type SiteSettings = {
  siteName: string
  biography: string
  experience: string
  avatarUrl?: string
  backgroundUrl?: string
}

type HomeProfile = {
  name: string
  introduction: string
  quote: string
  avatarUrl?: string
  socials: { name: string; url: string }[]
  tags: string[]
  updateTitle: string
  updateText: string
}

const defaultHomeProfile: HomeProfile = {
  name: 'baihu',
  introduction: '喜歡動手做，也喜歡把有趣的想法變成作品。',
  quote: 'Stay curious, keep building.',
  avatarUrl: '/avatar.png',
  socials: [
    { name: 'Instagram', url: 'https://www.instagram.com/baihu3210' },
    { name: 'Discord', url: 'https://discord.com/users/808972376619483137' },
    { name: 'GitHub', url: 'https://github.com/baihufox3210' },
  ],
  tags: ['FRC'],
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
}

async function readArticles(): Promise<Article[]> {
  const content = await fs.readFile(articlesFile, 'utf8')
  return JSON.parse(content) as Article[]
}

async function writeArticles(articles: Article[]) {
  await fs.writeFile(articlesFile, `${JSON.stringify(articles, null, 2)}\n`, 'utf8')
}

async function readSiteSettings(): Promise<SiteSettings> {
  const content = await fs.readFile(siteSettingsFile, 'utf8')
  return { ...defaultSiteSettings, ...(JSON.parse(content) as Partial<SiteSettings>) }
}

async function writeSiteSettings(settings: SiteSettings) {
  await fs.writeFile(siteSettingsFile, `${JSON.stringify(settings, null, 2)}\n`, 'utf8')
}

async function readHomeProfile(): Promise<HomeProfile> {
  const content = await fs.readFile(homeProfileFile, 'utf8')
  return { ...defaultHomeProfile, ...(JSON.parse(content) as Partial<HomeProfile>) }
}

function isAuthenticated(request: express.Request) {
  const sessionId = request.cookies.admin_session as string | undefined
  if (!sessionId) return false
  const expiresAt = sessions.get(sessionId)
  if (!expiresAt) return false
  if (expiresAt <= Date.now()) {
    sessions.delete(sessionId)
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
  const host = request.get('host')
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

setInterval(() => {
  const now = Date.now()
  for (const [sessionId, expiresAt] of sessions) {
    if (expiresAt <= now) sessions.delete(sessionId)
  }
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

app.post('/api/auth/login', requireSameOrigin, (request, response) => {
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
  for (const [existingSessionId, expiresAt] of sessions) {
    if (expiresAt <= now) sessions.delete(existingSessionId)
  }
  sessions.set(sessionId, now + sessionLifetimeMs)
  response.cookie('admin_session', sessionId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: sessionLifetimeMs,
  })
  response.json({ authenticated: true })
})

app.post('/api/auth/logout', requireSameOrigin, (request, response) => {
  const sessionId = request.cookies.admin_session as string | undefined
  if (sessionId) sessions.delete(sessionId)
  response.clearCookie('admin_session')
  response.json({ authenticated: false })
})

app.get('/api/articles', async (_request, response) => {
  const articles = await readArticles()
  response.json(articles.sort((first, second) => second.publishedAt.localeCompare(first.publishedAt)))
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
    const { siteName, biography, experience } = request.body as {
      siteName?: string
      biography?: string
      experience?: string
    }

    const updatedSettings: SiteSettings = {
      ...existingSettings,
      siteName: siteName?.trim() || defaultSiteSettings.siteName,
      biography: biography?.trim() || '',
      experience: experience?.trim() || '',
      ...(files?.avatar?.[0] ? { avatarUrl: `/uploads/${files.avatar[0].filename}` } : {}),
      ...(files?.background?.[0] ? { backgroundUrl: `/uploads/${files.background[0].filename}` } : {}),
    }

    await writeSiteSettings(updatedSettings)
    response.json(updatedSettings)
  },
)

app.put('/api/admin/home-profile', requireSameOrigin, requireAuthentication, upload.single('avatar'), validateUploadedImages, async (request, response) => {
  const existing = await readHomeProfile()
  const body = request.body as Partial<Record<keyof HomeProfile, string>>
  let socials: HomeProfile['socials']
  let tags: string[]
  try {
    socials = JSON.parse(body.socials ?? '[]') as HomeProfile['socials']
    tags = JSON.parse(body.tags ?? '[]') as string[]
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
  const updated: HomeProfile = {
    name: body.name?.trim() || defaultHomeProfile.name,
    introduction: body.introduction?.trim() ?? '',
    quote: body.quote?.trim() ?? '',
    socials: socials.map(({ name, url }) => ({ name: name.trim(), url: url.trim() })).filter(({ name, url }) => name && url),
    tags: tags.map((tag) => tag.trim()).filter(Boolean),
    updateTitle: body.updateTitle?.trim() || defaultHomeProfile.updateTitle,
    updateText: body.updateText?.trim() ?? '',
    ...(request.file ? { avatarUrl: `/uploads/${request.file.filename}` } : existing.avatarUrl ? { avatarUrl: existing.avatarUrl } : {}),
  }
  await fs.writeFile(homeProfileFile, `${JSON.stringify(updated, null, 2)}\n`, 'utf8')
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
  }

  const articles = await readArticles()
  await writeArticles([article, ...articles])
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
    ...(request.file ? { coverImage: `/uploads/${request.file.filename}` } : {}),
  }

  articles[articleIndex] = updatedArticle
  await writeArticles(articles)
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
  response.status(204).end()
})

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  void _next
  if (error instanceof multer.MulterError || (error instanceof Error && error.message === 'Unsupported image type.')) {
    response.status(400).json({ message: 'Upload rejected. Use a supported image under 8 MB.' })
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
