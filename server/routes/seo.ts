import { Router } from 'express'
import { escapeXml, siteOrigin } from '../origin.js'
import { readArticleSummaries, readProjects } from '../storage.js'

// Lists every public page for search engines, rebuilt from the current content on each
// request (cached for ten minutes). Dates are only given where they are real: the
// article list changes when the newest article does, the other pages have no date.
const router = Router()

const staticPages = ['/about', '/projects', '/friends']

function isoDate(value: string | undefined) {
  const time = value ? Date.parse(value) : Number.NaN
  return Number.isFinite(time) ? new Date(time).toISOString() : undefined
}

router.get('/sitemap.xml', async (request, response) => {
  const origin = siteOrigin(request)
  const [articles, projects] = await Promise.all([readArticleSummaries(), readProjects()])
  const entry = (path: string, lastmod?: string) =>
    `  <url>\n    <loc>${escapeXml(`${origin}${path}`)}</loc>\n${lastmod ? `    <lastmod>${lastmod}</lastmod>\n` : ''}  </url>`
  const latest = articles.map((article) => isoDate(article.updatedAt ?? article.publishedAt)).filter((date): date is string => Boolean(date)).sort().pop()

  const urls = [
    entry('/', latest),
    entry('/blog', latest),
    ...staticPages.map((page) => entry(page)),
    ...articles.map((article) => entry(`/blog/post/${encodeURIComponent(article.id)}`, isoDate(article.updatedAt ?? article.publishedAt))),
    ...projects.map((project) => entry(`/projects/${encodeURIComponent(project.id)}`, isoDate(project.updatedAt ?? project.publishedAt))),
  ]
  response.set('Cache-Control', 'public, max-age=600').type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>
`)
})

export default router
