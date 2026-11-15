import fs from 'node:fs/promises'
import path from 'node:path'
import { Router } from 'express'
import type { Request, Response } from 'express'
import { distDirectory, siteUrl } from '../config.js'
import { isTrustedProxyRequest } from '../security.js'
import { readArticleSummaries, readProjects, readSiteSettings } from '../storage.js'

// Link previews (Discord, LINE, Facebook, X…) read Open Graph tags from the HTML and do
// not run JavaScript, so the single-page app cannot supply them. For article and project
// links the reverse proxy asks this route instead of serving the static index.html: it
// returns the same built page with the title, description and cover filled in.
const router = Router()

// The page's own policy; the API-wide one forbids everything, which suits JSON only.
const pageSecurityPolicy = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"

let cachedPage: { mtimeMs: number; html: string } | undefined

async function readBuiltPage() {
  const file = path.join(distDirectory, 'index.html')
  const { mtimeMs } = await fs.stat(file)
  if (cachedPage?.mtimeMs !== mtimeMs) cachedPage = { mtimeMs, html: await fs.readFile(file, 'utf8') }
  return cachedPage.html
}

function escapeHtml(value: string) {
  return value.replace(/[<>&'"]/g, (character) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&#39;', '"': '&quot;' })[character] ?? character)
}

function siteOrigin(request: Request) {
  if (siteUrl) return siteUrl
  const forwardedProto = isTrustedProxyRequest(request) ? request.get('x-forwarded-proto')?.split(',')[0]?.trim() : undefined
  return `${forwardedProto === 'https' ? 'https' : request.protocol}://${request.get('host') ?? 'localhost'}`
}

type Preview = { title: string; description: string; image?: string; type: 'article' | 'website' }

async function sendPage(request: Request, response: Response, preview: Preview | undefined) {
  let html: string
  try {
    html = await readBuiltPage()
  } catch {
    // No build next to the API: the proxy falls back to its static index.html.
    response.status(404).json({ message: 'Page build not found.' })
    return
  }
  if (preview) {
    const origin = siteOrigin(request)
    const settings = await readSiteSettings()
    const title = `${preview.title} | ${settings.siteName}`
    const description = preview.description.replace(/\s+/g, ' ').trim().slice(0, 200)
    const image = preview.image ?? settings.avatarUrl
    const absolute = (url: string) => /^https?:\/\//.test(url) ? url : `${origin}${url}`
    const tags = [
      `<meta property="og:type" content="${preview.type}" />`,
      `<meta property="og:site_name" content="${escapeHtml(settings.siteName)}" />`,
      `<meta property="og:title" content="${escapeHtml(preview.title)}" />`,
      `<meta property="og:description" content="${escapeHtml(description)}" />`,
      `<meta property="og:url" content="${escapeHtml(`${origin}${request.path}`)}" />`,
      ...(image ? [`<meta property="og:image" content="${escapeHtml(absolute(image))}" />`] : []),
      // A large card only when the item has its own cover; the site avatar stays small.
      `<meta name="twitter:card" content="${preview.image ? 'summary_large_image' : 'summary'}" />`,
    ].join('\n    ')
    html = html
      .replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(title)}</title>`)
      .replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${escapeHtml(description)}" />`)
      .replace('</head>', `  ${tags}\n  </head>`)
  }
  response.set({ 'Content-Security-Policy': pageSecurityPolicy, 'Cache-Control': 'no-cache' }).type('html').send(html)
}

// The preview describes the article instead of quoting it, so the body is not given away
// in a chat embed: "隨筆 · 約 5 分鐘閱讀 · 2026/11/15 · #特選 #成大".
function describeArticle(article: { category: string; readingMinutes: number; publishedAt: string; tags: string[] }) {
  return [
    article.category && article.category !== 'Uncategorized' ? article.category : '',
    `約 ${article.readingMinutes} 分鐘閱讀`,
    new Date(article.publishedAt).toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei' }),
    article.tags.slice(0, 5).map((tag) => `#${tag}`).join(' '),
  ].filter(Boolean).join(' · ')
}

router.get('/blog/post/:id', async (request, response) => {
  const article = (await readArticleSummaries()).find((item) => item.id === request.params.id)
  await sendPage(request, response, article && { type: 'article', title: article.title, description: describeArticle(article), image: article.coverImage })
})

router.get('/projects/:id', async (request, response) => {
  const project = (await readProjects()).find((item) => item.id === request.params.id)
  await sendPage(request, response, project && { type: 'website', title: project.title, description: project.summary, image: project.coverImage })
})

export default router
