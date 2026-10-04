import crypto from 'node:crypto'
import { Router } from 'express'
import type { Article } from '../types.js'
import { recordActivity, readArticles, writeArticles } from '../storage.js'
import { requireAuthentication, requireSameOrigin } from '../security.js'
import { upload, validateUploadedImages, removeProjectUploads } from '../uploads.js'

const router = Router()

type ArticleInput = { title: string; content: string; category?: string; tags?: string; coverImagePosition?: string; coverImageScale?: number }

function isValidCoverPosition(value: unknown) {
  if (typeof value !== 'string') return false
  const match = /^(\d{1,3}(?:\.\d{1,2})?)%\s+(\d{1,3}(?:\.\d{1,2})?)%$/.exec(value)
  if (!match) return false
  return Number(match[1]) <= 100 && Number(match[2]) <= 100
}

function parseArticleInput(value: unknown): ArticleInput | undefined {
  if (!value || typeof value !== 'object') return undefined
  const body = value as Record<string, unknown>
  const { title, content, category, tags, coverImagePosition } = body
  const rawCoverImageScale = body.coverImageScale
  const coverImageScale = typeof rawCoverImageScale === 'string' && rawCoverImageScale.trim() ? Number(rawCoverImageScale) : rawCoverImageScale
  if (
    typeof title !== 'string' || !title.trim() || title.length > 200 ||
    typeof content !== 'string' || !content.trim() || content.length > 500_000 ||
    (category !== undefined && (typeof category !== 'string' || category.length > 100)) ||
    (tags !== undefined && (typeof tags !== 'string' || tags.length > 2000)) ||
    (coverImagePosition !== undefined && !isValidCoverPosition(coverImagePosition)) ||
    (coverImageScale !== undefined && (typeof coverImageScale !== 'number' || !Number.isFinite(coverImageScale) || coverImageScale < 1 || coverImageScale > 3))
  ) return undefined
  return { title, content, category, tags, coverImagePosition: coverImagePosition as string | undefined, coverImageScale }
}

function parseTags(tags: string | undefined) {
  return (tags ?? '').split(',').map((tag) => tag.trim()).filter(Boolean)
}

router.get('/', async (_request, response) => {
  const articles = await readArticles()
  response.json(articles.sort((first, second) => second.publishedAt.localeCompare(first.publishedAt)))
})

router.post('/', requireSameOrigin, requireAuthentication, upload.single('coverImage'), validateUploadedImages, async (request, response) => {
  const input = parseArticleInput(request.body)
  if (!input) {
    if (request.file) await removeProjectUploads([request.file])
    response.status(400).json({ message: 'Title, content, category, or tags are invalid or too long.' })
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
  response.status(201).json(article)
})

router.put('/:id', requireSameOrigin, requireAuthentication, upload.single('coverImage'), validateUploadedImages, async (request, response) => {
  const articles = await readArticles()
  const articleIndex = articles.findIndex((article) => article.id === request.params.id)
  if (articleIndex === -1) {
    if (request.file) await removeProjectUploads([request.file])
    response.status(404).json({ message: 'Article not found.' })
    return
  }

  const input = parseArticleInput(request.body)
  if (!input) {
    if (request.file) await removeProjectUploads([request.file])
    response.status(400).json({ message: 'Title, content, category, or tags are invalid or too long.' })
    return
  }

  const existingArticle = articles[articleIndex]
  if (!existingArticle) {
    if (request.file) await removeProjectUploads([request.file])
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
  await recordActivity({ at: now, type: 'article', action: 'updated', title: updatedArticle.title })
  response.json(updatedArticle)
})

router.delete('/:id', requireSameOrigin, requireAuthentication, async (request, response) => {
  const articles = await readArticles()
  const article = articles.find((entry) => entry.id === request.params.id)
  if (!article) {
    response.status(404).json({ message: 'Article not found.' })
    return
  }

  await writeArticles(articles.filter((entry) => entry.id !== request.params.id))
  await recordActivity({ at: new Date().toISOString(), type: 'article', action: 'deleted', title: article.title })
  response.status(204).end()
})

export default router
