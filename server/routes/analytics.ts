import fs from 'node:fs/promises'
import { isIP } from 'node:net'
import { Router } from 'express'
import { activityFile, analyticsEventRetentionDays } from '../config.js'
import { createRateLimiter } from '../rateLimit.js'
import { getAnalyticsRegion, getClientIp, requireAuthentication, requireSameOrigin } from '../security.js'
import { queuePageView, readAnalyticsDetails, readAnalyticsRegionStats, readAnalyticsTotals, readAnalyticsVisits, readArticleSummaries, waitForActivityWrites, waitForAnalyticsWrites } from '../storage.js'
import type { ActivityEntry, AnalyticsDevice, AnalyticsPage, AnalyticsSource } from '../types.js'
import { getAnalyticsDevice, parseUserAgent } from '../validation.js'

const router = Router()

const takePageView = createRateLimiter({ windowMs: 60_000, max: 60, maxEntries: 10_000 })

router.post('/analytics/view', requireSameOrigin, async (request, response) => {
  const limit = takePageView(getClientIp(request))
  if (limit !== 'allowed') {
    response.status(429).json({ message: limit === 'full' ? 'Analytics rate limit capacity reached.' : 'Too many page view events.' })
    return
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
    const articles = await readArticleSummaries()
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
  const text = (value: unknown, pattern: RegExp, maxLength: number) => typeof value === 'string' && value.length <= maxLength && pattern.test(value) ? value : undefined
  const userAgent = (request.get('user-agent') ?? '').slice(0, 400)
  try {
    await queuePageView({
      page, articleId, source,
      device: getAnalyticsDevice(userAgent),
      region: getAnalyticsRegion(request),
      ip: getClientIp(request).replace(/^::ffff:(?=\d+\.\d+\.\d+\.\d+$)/, ''),
      sessionId: text(request.body?.sessionId, /^[A-Za-z0-9-]+$/, 64),
      path: text(request.body?.path, /^\/[^\s]*$/, 200),
      referrer: text(request.body?.referrer, /^[a-z0-9.-]+$/i, 200)?.toLowerCase(),
      userAgent,
      ...parseUserAgent(userAgent),
    })
    response.status(204).end()
  } catch {
    response.status(500).json({ message: 'Could not record page view.' })
  }
})

router.get('/admin/analytics', requireAuthentication, async (request, response) => {
  await waitForAnalyticsWrites()
  const days = request.query.days === '1' ? 1 : request.query.days === '7' ? 7 : 30
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const currentStart = new Date(today.getTime() - (days - 1) * 86_400_000)
  const previousStart = new Date(currentStart.getTime() - days * 86_400_000)
  const currentStartDay = currentStart.toISOString().slice(0, 10)
  const previousStartDay = previousStart.toISOString().slice(0, 10)
  const todayDay = today.toISOString().slice(0, 10)
  const [totals, regionStats, details, articles] = await Promise.all([
    readAnalyticsTotals(currentStartDay, todayDay, previousStartDay),
    readAnalyticsRegionStats(currentStartDay, todayDay),
    readAnalyticsDetails(currentStartDay, todayDay),
    readArticleSummaries(),
  ])
  const sourceTotals: Record<AnalyticsSource, number> = { direct: 0, search: 0, social: 0, referral: 0 }
  const deviceTotals: Record<AnalyticsDevice, number> = { mobile: 0, tablet: 0, desktop: 0 }
  for (const { key, views } of totals.sources) if (key) sourceTotals[key] += views
  for (const { key, views } of totals.devices) deviceTotals[key] += views
  const dailyTotals = new Map(totals.daily.map(({ key, views }) => [key, views]))
  const totalViews = totals.daily.reduce((total, { views }) => total + views, 0)
  const previousViews = totals.previousViews
  const labels: Record<AnalyticsPage, string> = { home: '首頁', about: '關於', projects: '作品', blog: 'Blog', article: '文章閱讀', contact: '聯絡', friends: '友站' }
  const daily = Array.from({ length: days }, (_unused, index) => {
    const date = new Date(currentStart.getTime() + index * 86_400_000)
    const day = date.toISOString().slice(0, 10)
    return { day, views: dailyTotals.get(day) ?? 0 }
  })
  const topPages = totals.pages.map(({ key: page, views }) => ({ page, label: labels[page], views })).sort((first, second) => second.views - first.views)
  const articleById = new Map(articles.map((article) => [article.id, article]))
  const topArticles = totals.topArticles.map(({ key: id, views }) => ({ id, title: articleById.get(id)?.title ?? '已刪除文章', views }))
  response.json({ days, totalViews, previousViews, ...regionStats, daily, topPages, topArticles, sources: sourceTotals, devices: deviceTotals, ...details, eventRetentionDays: analyticsEventRetentionDays })
})

router.get('/admin/analytics/visits', requireAuthentication, async (request, response) => {
  await waitForAnalyticsWrites()
  const ip = typeof request.query.ip === 'string' && request.query.ip ? request.query.ip : undefined
  if (ip && !isIP(ip)) {
    response.status(400).json({ message: 'Invalid IP address.' })
    return
  }
  const before = Number(request.query.before)
  const limit = 50
  const [visits, articles] = await Promise.all([
    readAnalyticsVisits({ ip, before: Number.isInteger(before) && before > 0 ? before : undefined, limit: limit + 1 }),
    readArticleSummaries(),
  ])
  const titles = new Map(articles.map((article) => [article.id, article.title]))
  response.json({
    visits: visits.slice(0, limit).map((visit) => ({ ...visit, articleTitle: visit.articleId ? titles.get(visit.articleId) ?? '已刪除文章' : '' })),
    hasMore: visits.length > limit,
  })
})

router.get('/admin/activity', requireAuthentication, async (_request, response) => {
  await waitForActivityWrites()
  response.json(JSON.parse(await fs.readFile(activityFile, 'utf8')) as ActivityEntry[])
})

export default router
