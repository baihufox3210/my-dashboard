import crypto from 'node:crypto'
import { Router } from 'express'
import type { Article } from '../types.js'
import { createRateLimiter } from '../rateLimit.js'
import { articleReactions, deleteArticleReactions, readArticleReactions, recordActivity, readArticleSummaries, readArticles, summarizeArticle, toggleArticleReaction, writeArticles, type ArticleReaction } from '../storage.js'
import { getClientIp, requireAuthentication, requireSameOrigin } from '../security.js'
import { contentUploads, upload, validateUploadedImages, discardUploadedFiles, removeUnusedUploads } from '../uploads.js'
import { parseCoverSettings, type CoverSettings } from '../validation.js'

const router = Router()

type ArticleInput = { title: string; content: string; category?: string; tags?: string } & CoverSettings

// Returns the parsed input, or a message naming the field that is wrong.
function parseArticleInput(value: unknown): ArticleInput | string {
  if (!value || typeof value !== 'object') return '缺少文章資料。'
  const { title, content, category, tags } = value as Record<string, unknown>
  const cover = parseCoverSettings(value)
  if (typeof title !== 'string' || !title.trim()) return '請輸入文章標題。'
  if (title.length > 200) return '標題太長（上限 200 字）。'
  if (typeof content !== 'string' || !content.trim()) return '請輸入文章內容。'
  if (content.length > 500_000) return `內容太長（${content.length.toLocaleString()} 字，上限 500,000 字）。`
  if (category !== undefined && (typeof category !== 'string' || category.length > 100)) return '分類太長（上限 100 字）。'
  if (tags !== undefined && (typeof tags !== 'string' || tags.length > 2000)) return '標籤太長（上限 2,000 字）。'
  if (!cover) return '封面位置或縮放設定無效，請重新調整封面。'
  return { title, content, category, tags, ...cover }
}

function parseTags(tags: string | undefined) {
  return (tags ?? '').split(',').map((tag) => tag.trim()).filter(Boolean)
}

router.get('/', async (_request, response) => {
  response.json(await readArticleSummaries())
})

router.get('/:id', async (request, response) => {
  const article = (await readArticles()).find((entry) => entry.id === request.params.id)
  if (!article) {
    response.status(404).json({ message: 'Article not found.' })
    return
  }
  response.json(article)
})

const takeReaction = createRateLimiter({ windowMs: 60_000, max: 30, maxEntries: 10_000 })

async function articleExists(id: string) {
  return (await readArticleSummaries()).some((article) => article.id === id)
}

// One reaction of each kind per visitor IP; the response says which ones are the caller's.
router.get('/:id/reactions', async (request, response) => {
  const id = String(request.params.id)
  if (!await articleExists(id)) { response.status(404).json({ message: 'Article not found.' }); return }
  response.json(readArticleReactions(id, getClientIp(request)))
})

router.post('/:id/reactions', requireSameOrigin, async (request, response) => {
  const reaction = (request.body as { reaction?: unknown } | undefined)?.reaction
  if (!articleReactions.includes(reaction as ArticleReaction)) { response.status(400).json({ message: 'Invalid reaction.' }); return }
  const id = String(request.params.id)
  if (!await articleExists(id)) { response.status(404).json({ message: 'Article not found.' }); return }
  const ip = getClientIp(request)
  if (takeReaction(ip) !== 'allowed') { response.status(429).json({ message: 'Too many reactions.' }); return }
  response.json(toggleArticleReaction(id, reaction as ArticleReaction, ip))
})

router.post('/images', requireSameOrigin, requireAuthentication, upload.single('image'), validateUploadedImages, (request, response) => {
  if (!request.file) { response.status(400).json({ message: '請選擇要插入的圖片。' }); return }
  response.status(201).json({ url: `/uploads/${request.file.filename}` })
})

router.post('/', requireSameOrigin, requireAuthentication, upload.single('coverImage'), validateUploadedImages, async (request, response) => {
  const input = parseArticleInput(request.body)
  if (typeof input === 'string') {
    if (request.file) await discardUploadedFiles([request.file])
    response.status(400).json({ message: input })
    return
  }

  const now = new Date().toISOString()
  const article: Article = {
    id: crypto.randomUUID(),
    title: input.title.trim(),
    content: input.content,
    category: input.category?.trim() || 'Uncategorized',
    tags: parseTags(input.tags),
    ...(request.file ? { coverImage: `/uploads/${request.file.filename}` } : {}),
    ...(input.coverImagePosition ? { coverImagePosition: input.coverImagePosition } : {}),
    ...(input.coverImageScale ? { coverImageScale: input.coverImageScale } : {}),
    publishedAt: now,
    updatedAt: now,
  }

  const articles = await readArticles()
  await writeArticles([article, ...articles])
  await recordActivity({ at: now, type: 'article', action: 'published', title: article.title })
  response.status(201).json({ ...summarizeArticle(article), content: article.content })
})

router.put('/:id', requireSameOrigin, requireAuthentication, upload.single('coverImage'), validateUploadedImages, async (request, response) => {
  const articles = await readArticles()
  const articleIndex = articles.findIndex((article) => article.id === request.params.id)
  if (articleIndex === -1) {
    if (request.file) await discardUploadedFiles([request.file])
    response.status(404).json({ message: 'Article not found.' })
    return
  }

  const input = parseArticleInput(request.body)
  if (typeof input === 'string') {
    if (request.file) await discardUploadedFiles([request.file])
    response.status(400).json({ message: input })
    return
  }

  const existingArticle = articles[articleIndex]
  if (!existingArticle) {
    if (request.file) await discardUploadedFiles([request.file])
    response.status(404).json({ message: 'Article not found.' })
    return
  }
  const now = new Date().toISOString()
  const updatedArticle: Article = {
    ...existingArticle,
    title: input.title.trim(),
    content: input.content,
    category: input.category?.trim() || 'Uncategorized',
    tags: parseTags(input.tags),
    updatedAt: now,
    ...(request.file ? { coverImage: `/uploads/${request.file.filename}` } : {}),
    ...(input.coverImagePosition ? { coverImagePosition: input.coverImagePosition } : {}),
    ...(input.coverImageScale ? { coverImageScale: input.coverImageScale } : {}),
  }

  articles[articleIndex] = updatedArticle
  await writeArticles(articles)
  const removedImages = contentUploads(existingArticle.content).filter((url) => !updatedArticle.content.includes(url))
  await removeUnusedUploads(...(request.file ? [existingArticle.coverImage] : []), ...removedImages)
  await recordActivity({ at: now, type: 'article', action: 'updated', title: updatedArticle.title })
  response.json({ ...summarizeArticle(updatedArticle), content: updatedArticle.content })
})

router.delete('/:id', requireSameOrigin, requireAuthentication, async (request, response) => {
  const articles = await readArticles()
  const article = articles.find((entry) => entry.id === request.params.id)
  if (!article) {
    response.status(404).json({ message: 'Article not found.' })
    return
  }

  await writeArticles(articles.filter((entry) => entry.id !== request.params.id))
  await removeUnusedUploads(article.coverImage, ...contentUploads(article.content))
  deleteArticleReactions(article.id)
  await recordActivity({ at: new Date().toISOString(), type: 'article', action: 'deleted', title: article.title })
  response.status(204).end()
})

export default router
