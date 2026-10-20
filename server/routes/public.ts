import os from 'node:os'
import { Router } from 'express'
import { siteStartDate } from '../config.js'
import { readArticleSummaries, readFriends, readHomeProfile, readMusicTracks, readProjects, readSiteSettings } from '../storage.js'
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

export default router
