import fs from 'node:fs/promises'
import path from 'node:path'
import { Router } from 'express'
import type { Request, Response } from 'express'
import { distDirectory } from '../config.js'
import { crawlerHtml } from '../crawlerHtml.js'
import { escapeHtml, siteOrigin } from '../origin.js'
import type { Article, Project } from '../types.js'
import { readArticles, readHomeProfile, readProjects, readSiteSettings, summarizeArticle } from '../storage.js'

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

type Preview = {
  type: 'article' | 'website'
  title: string
  // What a chat embed shows (og:description).
  description: string
  // What a search result may show (<meta name="description">); defaults to `description`.
  summary?: string
  // The whole <title> when the author chose one; otherwise "<title> | <site name>".
  pageTitle?: string
  image?: string
  // Full path of the page. Every URL that serves the same content (short links) names it
  // as canonical, so search engines count them as one page.
  canonical: string
  // Markdown that is also written into the HTML for crawlers that do not run scripts.
  body: string
  article?: { publishedAt: string; updatedAt?: string; category: string; tags: string[]; wordCount: number }
}

// Replacers are functions on purpose: a string replacement would treat "$&" or "$1" in an
// article as a pattern.
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
    const [settings, profile] = await Promise.all([readSiteSettings(), readHomeProfile()])
    const title = preview.pageTitle ?? `${preview.title} | ${settings.siteName}`
    const clean = (text: string) => text.replace(/\s+/g, ' ').trim().slice(0, 200)
    const description = clean(preview.description)
    const summary = clean(preview.summary ?? preview.description)
    const image = preview.image ?? settings.avatarUrl
    const absolute = (url: string) => /^https?:\/\//.test(url) ? url : `${origin}${url}`
    const canonical = `${origin}${preview.canonical}`
    const structured = preview.article && {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: preview.title,
      description: summary,
      ...(image ? { image: [absolute(image)] } : {}),
      datePublished: preview.article.publishedAt,
      dateModified: preview.article.updatedAt ?? preview.article.publishedAt,
      mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
      author: { '@type': 'Person', name: profile.name },
      ...(preview.article.category && preview.article.category !== 'Uncategorized' ? { articleSection: preview.article.category } : {}),
      ...(preview.article.tags.length ? { keywords: preview.article.tags.join(', ') } : {}),
      wordCount: preview.article.wordCount,
      inLanguage: 'zh-TW',
    }
    const tags = [
      `<link rel="canonical" href="${escapeHtml(canonical)}" />`,
      `<meta name="robots" content="max-image-preview:large" />`,
      `<meta property="og:type" content="${preview.type}" />`,
      `<meta property="og:site_name" content="${escapeHtml(settings.siteName)}" />`,
      `<meta property="og:title" content="${escapeHtml(preview.title)}" />`,
      `<meta property="og:description" content="${escapeHtml(description)}" />`,
      `<meta property="og:url" content="${escapeHtml(canonical)}" />`,
      ...(image ? [`<meta property="og:image" content="${escapeHtml(absolute(image))}" />`] : []),
      // A large card only when the item has its own cover; the site avatar stays small.
      `<meta name="twitter:card" content="${preview.image ? 'summary_large_image' : 'summary'}" />`,
      ...(structured ? [`<script type="application/ld+json">${JSON.stringify(structured).replace(/</g, '\\u003c')}</script>`] : []),
    ].join('\n    ')
    const content = `<article><h1>${escapeHtml(preview.title)}</h1>${crawlerHtml(preview.body, absolute)}</article>`
    html = html
      .replace(/<title>[^<]*<\/title>/, () => `<title>${escapeHtml(title)}</title>`)
      .replace(/<meta name="description"[^>]*>/, () => `<meta name="description" content="${escapeHtml(summary)}" />`)
      .replace('</head>', () => `  ${tags}\n  </head>`)
      .replace('<div id="root"></div>', () => `<div id="root">${content}</div>`)
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

function articlePreview(article: Article): Preview {
  const summary = summarizeArticle(article)
  return {
    type: 'article',
    title: article.title,
    description: describeArticle(summary),
    summary: article.seoDescription || summary.excerpt,
    pageTitle: article.seoTitle,
    image: article.coverImage,
    canonical: `/blog/post/${encodeURIComponent(article.id)}`,
    body: article.content,
    article: { publishedAt: article.publishedAt, updatedAt: article.updatedAt, category: article.category, tags: article.tags, wordCount: summary.wordCount },
  }
}

function projectPreview(project: Project): Preview {
  return { type: 'website', title: project.title, description: project.summary, image: project.coverImage, canonical: `/projects/${encodeURIComponent(project.id)}`, body: project.description }
}

router.get('/blog/post/:id', async (request, response) => {
  const article = (await readArticles()).find((item) => item.id === request.params.id)
  await sendPage(request, response, article && articlePreview(article))
})

// Short links from the share buttons: the first 8 characters of the id pick the item,
// the rest is random so every shared link is new to chat apps' preview caches.
function findByCode<T extends { id: string }>(items: T[], code: string) {
  if (!/^[0-9a-f]{8}[0-9a-z]{0,8}$/i.test(code)) return undefined
  const key = code.slice(0, 8).toLowerCase()
  const matches = items.filter((item) => item.id.replace(/-/g, '').slice(0, 8).toLowerCase() === key)
  return matches.length === 1 ? matches[0] : undefined
}

router.get('/b/:code', async (request, response) => {
  const article = findByCode(await readArticles(), String(request.params.code))
  await sendPage(request, response, article && articlePreview(article))
})

router.get('/p/:code', async (request, response) => {
  const project = findByCode(await readProjects(), String(request.params.code))
  await sendPage(request, response, project && projectPreview(project))
})

router.get('/projects/:id', async (request, response) => {
  const project = (await readProjects()).find((item) => item.id === request.params.id)
  await sendPage(request, response, project && projectPreview(project))
})

export default router
