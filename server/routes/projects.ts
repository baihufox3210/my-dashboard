import crypto from 'node:crypto'
import { Router } from 'express'
import { requireAuthentication, requireSameOrigin } from '../security.js'
import { readProjects, writeProjects } from '../storage.js'
import type { Project } from '../types.js'
import { projectUpload, discardUploadedFiles, removeUnusedUploads, uploadedFiles, validateProjectFiles } from '../uploads.js'
import { boundedText, isSafeSocialUrl, parseCoverSettings } from '../validation.js'

const router = Router()

type ProjectFields = Pick<Project, 'title' | 'summary' | 'description' | 'category' | 'tags' | 'projectUrl' | 'coverImagePosition' | 'coverImageScale'>

function parseProjectInput(value: unknown): ProjectFields | null {
  const coverSettings = parseCoverSettings(value)
  const { title, summary = '', description = '', category = '', tags = '', projectUrl = '' } = (value ?? {}) as Record<string, unknown>
  if (
    !coverSettings || typeof title !== 'string' || !title.trim() || !boundedText(title, 160) ||
    !boundedText(summary, 500) || !boundedText(description, 100_000) || !boundedText(category, 80) ||
    !boundedText(tags, 2000) || !boundedText(projectUrl, 2048)
  ) return null
  const url = (projectUrl as string).trim()
  if (url && !isSafeSocialUrl(url)) return null
  return {
    title: title.trim(), summary: (summary as string).trim(), description: (description as string).trim(), category: (category as string).trim(),
    tags: (tags as string).split(',').map((tag) => tag.trim()).filter(Boolean), projectUrl: url, ...coverSettings,
  }
}

const receiveProjectFiles = projectUpload.fields([{ name: 'coverImage', maxCount: 1 }, { name: 'document', maxCount: 1 }])
router.post('/', requireSameOrigin, requireAuthentication, receiveProjectFiles, validateProjectFiles, async (request, response) => {
  const input = parseProjectInput(request.body)
  if (!input) {
    await discardUploadedFiles(uploadedFiles(request))
    response.status(400).json({ message: '專案標題、內容或連結格式不正確，或超過字數限制。' }); return
  }
  const files = request.files as { coverImage?: Express.Multer.File[]; document?: Express.Multer.File[] } | undefined
  const now = new Date().toISOString()
  const project: Project = {
    id: crypto.randomUUID(), ...input,
    ...(files?.coverImage?.[0] ? { coverImage: `/uploads/${files.coverImage[0].filename}` } : {}),
    ...(files?.document?.[0] ? { documentUrl: `/uploads/${files.document[0].filename}`, documentName: files.document[0].originalname } : {}), publishedAt: now, updatedAt: now,
  }
  try { await writeProjects([project, ...await readProjects()]) }
  catch (error) { await discardUploadedFiles(uploadedFiles(request)); throw error }
  response.status(201).json(project)
})

router.put('/:id', requireSameOrigin, requireAuthentication, receiveProjectFiles, validateProjectFiles, async (request, response) => {
  const files = request.files as { coverImage?: Express.Multer.File[]; document?: Express.Multer.File[] } | undefined
  const projects = await readProjects()
  const index = projects.findIndex((project) => project.id === request.params.id)
  const existing = projects[index]
  if (!existing) {
    await discardUploadedFiles(uploadedFiles(request))
    response.status(404).json({ message: '找不到這個專案。' }); return
  }
  const input = parseProjectInput(request.body)
  const removeDocument = (request.body as { removeDocument?: string } | undefined)?.removeDocument === 'true'
  if (!input) {
    await discardUploadedFiles(uploadedFiles(request))
    response.status(400).json({ message: '專案標題、內容或連結格式不正確，或超過字數限制。' }); return
  }
  const oldCover = existing.coverImage
  const oldDocument = existing.documentUrl
  projects[index] = {
    ...existing, ...input, updatedAt: new Date().toISOString(),
    ...(files?.coverImage?.[0] ? { coverImage: `/uploads/${files.coverImage[0].filename}` } : {}),
    ...(files?.document?.[0] ? { documentUrl: `/uploads/${files.document[0].filename}`, documentName: files.document[0].originalname } : removeDocument ? { documentUrl: undefined, documentName: undefined } : {}),
  }
  try { await writeProjects(projects) }
  catch (error) { await discardUploadedFiles(uploadedFiles(request)); throw error }
  await removeUnusedUploads(
    files?.coverImage?.[0] ? oldCover : undefined,
    files?.document?.[0] || removeDocument ? oldDocument : undefined,
  )
  response.json(projects[index])
})

router.delete('/:id', requireSameOrigin, requireAuthentication, async (request, response) => {
  const projects = await readProjects()
  const project = projects.find((item) => item.id === request.params.id)
  if (!project) { response.status(404).json({ message: '找不到這個專案。' }); return }
  await writeProjects(projects.filter((item) => item.id !== request.params.id))
  await removeUnusedUploads(project.coverImage, project.documentUrl)
  response.status(204).end()
})

export default router
