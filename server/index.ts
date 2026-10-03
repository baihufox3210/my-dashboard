import cookieParser from 'cookie-parser'
import crypto from 'node:crypto'
import express from 'express'
import fs from 'node:fs/promises'
import multer from 'multer'
import {
  activityFile,
  adminPassword,
  adminUsername,
  analyticsFile,
  host,
  port,
  sessionLifetimeMs,
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
  type Friend,
  type HomeProfile,
  type Project,
  type SiteSettings,
} from './types.js'
import {
  ensureStorage,
  persistSessions,
  queuePageView,
  readArticles,
  readFriends,
  readHomeProfile,
  readProjects,
  readSiteSettings,
  recordActivity,
  waitForActivityWrites,
  waitForAnalyticsWrites,
  writeFriends,
  writeHomeProfile,
  writeProjects,
  writeSiteSettings,
} from './storage.js'
import { projectUpload, removeProjectAssets, removeProjectUploads, upload, validateProjectFiles, validateUploadedImages } from './uploads.js'
import { boundedText, getAnalyticsDevice, isSafeSocialUrl } from './validation.js'
import { getClientIp, hashSessionId, isAuthenticated, loginFailures, requireAuthentication, requireSameOrigin, sessions } from './security.js'
import articleRoutes from './routes/articles.js'
import publicRoutes from './routes/public.js'

const analyticsRateLimits = new Map<string, { count: number; windowStarted: number }>()

setInterval(() => {
  const now = Date.now()
  let removed = false
  for (const [sessionId, expiresAt] of sessions) {
    if (expiresAt <= now) { sessions.delete(sessionId); removed = true }
  }
  if (removed) void persistSessions(sessions).catch((error: unknown) => console.error('Could not persist admin sessions:', error))
}, 60 * 60 * 1000).unref()

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
app.use('/api/articles', articleRoutes)
app.use('/api', publicRoutes)

app.get('/api/auth/me', (request, response) => {
  response.json({ authenticated: isAuthenticated(request) })
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
  await persistSessions(sessions)
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
  await persistSessions(sessions)
  response.clearCookie('admin_session')
  response.json({ authenticated: false })
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
  await waitForAnalyticsWrites()
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
  await waitForActivityWrites()
  response.json(JSON.parse(await fs.readFile(activityFile, 'utf8')) as ActivityEntry[])
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
  await writeHomeProfile(updated)
  await recordActivity({ at: new Date().toISOString(), type: 'homepage', action: 'saved', title: '首頁個人介紹' })
  response.json(updated)
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

ensureStorage(sessions).then(() => {
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
