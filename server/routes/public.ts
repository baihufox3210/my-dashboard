import os from 'node:os'
import { Router } from 'express'
import type { Request } from 'express'
import { siteStartDate, siteUrl } from '../config.js'
import { isTrustedProxyRequest } from '../security.js'
import { readArticleSummaries, readFriends, readHomeProfile, readMusicTracks, readProjects, readSiteSettings, readVisitCounts } from '../storage.js'
import { daysSince } from '../validation.js'

const router = Router()

router.get('/site-settings', async (_request, response) => {
  response.json(await readSiteSettings())
})

router.get('/home-profile', async (_request, response) => {
  response.json(await readHomeProfile())
})

router.get('/friends', async (_request, response) => response.json(await readFriends()))

router.get('/music', async (_request, response) => response.json(await readMusicTracks()))

router.get('/server-status', async (_request, response) => {
  const [articles, projects, music] = await Promise.all([readArticleSummaries(), readProjects(), readMusicTracks()])
  const activityTimes = [
    ...articles.map((item) => item.updatedAt ?? item.publishedAt),
    ...projects.map((item) => item.updatedAt ?? item.publishedAt),
    ...music.map((item) => item.createdAt),
  ].map((value) => new Date(value).getTime()).filter(Number.isFinite)
  const latestActivity = activityTimes.length ? new Date(Math.max(...activityTimes)).toISOString() : null
  response.json({ status: 'online', uptimeSeconds: Math.floor(os.uptime()), lastActivity: latestActivity })
})

router.get('/projects', async (_request, response) => {
  const projects = await readProjects()
  response.json(projects.sort((first, second) => second.publishedAt.localeCompare(first.publishedAt)))
})

router.get('/stats', async (_request, response) => {
  const articles = await readArticleSummaries()
  const tags = new Set(articles.flatMap((article) => article.tags))
  const categories = new Set(articles.map((article) => article.category).filter(Boolean))
  const totalWords = articles.reduce((total, article) => total + article.wordCount, 0)
  const latestArticle = articles[0]

  response.json({
    articleCount: articles.length,
    categoryCount: categories.size,
    tagCount: tags.size,
    totalWords,
    runtimeDays: daysSince(siteStartDate),
    lastActivity: latestArticle?.publishedAt ?? null,
  })
})

router.get('/visits', async (_request, response) => {
  response.json(await readVisitCounts())
})

function siteOrigin(request: Request) {
  if (siteUrl) return siteUrl
  const forwardedProto = isTrustedProxyRequest(request) ? request.get('x-forwarded-proto')?.split(',')[0]?.trim() : undefined
  return `${forwardedProto === 'https' ? 'https' : request.protocol}://${request.get('host') ?? 'localhost'}`
}

function escapeXml(value: string) {
  return value.replace(/[<>&'"]/g, (character) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[character] ?? character)
}

// RSS 2.0 feed of the latest posts, linking to their shareable /blog/post/:id pages.
router.get('/rss.xml', async (request, response) => {
  const [articles, settings] = await Promise.all([readArticleSummaries(), readSiteSettings()])
  const origin = siteOrigin(request)
  const items = articles.slice(0, 20).map((article) => {
    const link = `${origin}/blog/post/${encodeURIComponent(article.id)}`
    return `    <item>
      <title>${escapeXml(article.title)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="true">${escapeXml(link)}</guid>
      <pubDate>${new Date(article.publishedAt).toUTCString()}</pubDate>
${article.category ? `      <category>${escapeXml(article.category)}</category>\n` : ''}      <description>${escapeXml(article.excerpt)}</description>
    </item>`
  }).join('\n')
  response.set('Cache-Control', 'public, max-age=600')
  response.type('application/rss+xml').send(`<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(settings.siteName)}</title>
    <link>${escapeXml(`${origin}/blog`)}</link>
    <description>${escapeXml(`${settings.siteName} 的最新文章`)}</description>
    <language>zh-TW</language>
${items}
  </channel>
</rss>
`)
})

export default router
