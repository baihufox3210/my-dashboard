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
const uploadsDirectory = path.join(projectDirectory, 'public', 'uploads')
const sessions = new Set<string>()
const port = Number(process.env.PORT ?? 3001)
const adminUsername = process.env.ADMIN_USERNAME ?? 'admin'
const adminPassword = process.env.ADMIN_PASSWORD ?? 'change-me'
const siteStartDate = process.env.SITE_START_DATE ?? new Date().toISOString()

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

const defaultSiteSettings: SiteSettings = {
  siteName: 'Baihu Personal Website',
  biography: '',
  experience: '',
}

const upload = multer({
  dest: uploadsDirectory,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_request, file, callback) => {
    callback(null, file.mimetype.startsWith('image/'))
  },
})

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

function isAuthenticated(request: express.Request) {
  const sessionId = request.cookies.admin_session as string | undefined
  return Boolean(sessionId && sessions.has(sessionId))
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

function daysSince(dateString: string) {
  const start = new Date(dateString).getTime()
  return Math.max(0, Math.floor((Date.now() - start) / 86_400_000))
}

const app = express()
app.use(express.json({ limit: '1mb' }))
app.use(cookieParser())
app.use('/uploads', express.static(uploadsDirectory))

app.get('/api/auth/me', (request, response) => {
  response.json({ authenticated: isAuthenticated(request) })
})

app.get('/api/site-settings', async (_request, response) => {
  response.json(await readSiteSettings())
})

app.post('/api/auth/login', (request, response) => {
  const { username, password } = request.body as { username?: string; password?: string }

  if (username !== adminUsername || password !== adminPassword) {
    response.status(401).json({ message: 'Invalid username or password.' })
    return
  }

  const sessionId = crypto.randomBytes(32).toString('hex')
  sessions.add(sessionId)
  response.cookie('admin_session', sessionId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 86_400_000,
  })
  response.json({ authenticated: true })
})

app.post('/api/auth/logout', (request, response) => {
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
  requireAuthentication,
  upload.fields([
    { name: 'avatar', maxCount: 1 },
    { name: 'background', maxCount: 1 },
  ]),
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

app.post('/api/articles', requireAuthentication, upload.single('coverImage'), async (request, response) => {
  const { title, content, category, tags } = request.body as {
    title?: string
    content?: string
    category?: string
    tags?: string
  }

  if (!title?.trim() || !content?.trim()) {
    response.status(400).json({ message: 'Title and content are required.' })
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

app.put('/api/articles/:id', requireAuthentication, upload.single('coverImage'), async (request, response) => {
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

  if (!title?.trim() || !content?.trim()) {
    response.status(400).json({ message: 'Title and content are required.' })
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

app.delete('/api/articles/:id', requireAuthentication, async (request, response) => {
  const articles = await readArticles()
  const article = articles.find((entry) => entry.id === request.params.id)

  if (!article) {
    response.status(404).json({ message: 'Article not found.' })
    return
  }

  await writeArticles(articles.filter((entry) => entry.id !== request.params.id))
  response.status(204).end()
})

ensureStorage().then(() => {
  app.listen(port, () => {
    console.log(`API server listening on http://localhost:${port}`)
  })
})
