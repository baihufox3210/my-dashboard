import crypto from 'node:crypto'
import { Router } from 'express'
import { requireAuthentication, requireSameOrigin } from '../security.js'
import { readFriends, writeFriends } from '../storage.js'
import type { Friend } from '../types.js'
import { discardUploadedFiles, removeUnusedUploads, upload, uploadedFiles, validateUploadedImages } from '../uploads.js'
import { boundedText, isSafeSocialUrl } from '../validation.js'

const router = Router()

router.post('/', requireSameOrigin, requireAuthentication, upload.single('avatar'), validateUploadedImages, async (request, response) => {
  const { name, introduction, url } = request.body as { name?: string; introduction?: string; url?: string }
  if (!name?.trim() || !boundedText(name, 120) || !boundedText(introduction ?? '', 1000) || !url || !isSafeSocialUrl(url.trim())) {
    await discardUploadedFiles(uploadedFiles(request))
    response.status(400).json({ message: '朋友名稱、自介或連結格式不正確。' }); return
  }
  const friend: Friend = { id: crypto.randomUUID(), name: name.trim(), introduction: introduction?.trim() ?? '', url: url.trim(), ...(request.file ? { avatarUrl: `/uploads/${request.file.filename}` } : {}) }
  const friends = await readFriends(); friends.push(friend); await writeFriends(friends); response.status(201).json(friend)
})

router.put('/:id', requireSameOrigin, requireAuthentication, upload.single('avatar'), validateUploadedImages, async (request, response) => {
  const { name, introduction, url } = request.body as { name?: string; introduction?: string; url?: string }
  if (!name?.trim() || !boundedText(name, 120) || !boundedText(introduction ?? '', 1000) || !url || !isSafeSocialUrl(url.trim())) {
    await discardUploadedFiles(uploadedFiles(request))
    response.status(400).json({ message: '朋友名稱、自介或連結格式不正確。' }); return
  }
  const friends = await readFriends(); const index = friends.findIndex((item) => item.id === request.params.id)
  const existing = friends[index]
  if (!existing) {
    await discardUploadedFiles(uploadedFiles(request))
    response.status(404).json({ message: '找不到這位朋友。' }); return
  }
  const updated: Friend = { ...existing, name: name.trim(), introduction: introduction?.trim() ?? '', url: url.trim(), ...(request.file ? { avatarUrl: `/uploads/${request.file.filename}` } : {}) }
  friends[index] = updated; await writeFriends(friends)
  if (request.file) await removeUnusedUploads(existing.avatarUrl)
  response.json(updated)
})

router.delete('/:id', requireSameOrigin, requireAuthentication, async (request, response) => {
  const friends = await readFriends()
  const friend = friends.find((item) => item.id === request.params.id)
  if (!friend) { response.status(404).json({ message: '找不到這位朋友。' }); return }
  await writeFriends(friends.filter((item) => item.id !== friend.id))
  await removeUnusedUploads(friend.avatarUrl)
  response.status(204).end()
})

export default router
