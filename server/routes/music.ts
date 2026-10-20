import crypto from 'node:crypto'
import { createReadStream } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import { Router } from 'express'
import { uploadsDirectory } from '../config.js'
import { requireAuthentication, requireSameOrigin } from '../security.js'
import { readMusicTracks, writeMusicTracks } from '../storage.js'
import type { MusicTrack } from '../types.js'
import { musicUpload, removeUnusedUploads, validateMusicFiles } from '../uploads.js'

const router = Router()

function normalizeUploadedFileName(fileName: string) {
  const safeName = [...fileName.replace(/^.*[\\/]/, '')].filter((character) => {
    const code = character.charCodeAt(0)
    return code >= 32 && code !== 127
  }).join('').trim()
  if (!/[ÃÂæåçèé]/.test(safeName)) return safeName
  try {
    const repaired = Buffer.from(safeName, 'latin1').toString('utf8')
    return repaired.includes('�') ? safeName : repaired
  } catch { return safeName }
}

function pathWithoutExtension(fileName: string) {
  return fileName.replace(/\.[^./\\]+$/, '').trim()
}

async function fingerprintFile(filePath: string) {
  const hash = crypto.createHash('sha256')
  await pipeline(createReadStream(filePath), hash)
  return hash.digest('hex')
}

async function fingerprintTrack(track: MusicTrack) {
  if (track.fingerprint) return track.fingerprint
  const filename = path.basename(track.fileUrl)
  if (!filename || filename !== track.fileUrl.slice('/uploads/'.length)) return null
  try { return await fingerprintFile(path.join(uploadsDirectory, filename)) }
  catch { return null }
}

router.post('/', requireSameOrigin, requireAuthentication, musicUpload.array('tracks', 20), validateMusicFiles, async (request, response) => {
  const files = Array.isArray(request.files) ? request.files : []
  if (!files.length) {
    response.status(400).json({ message: '請選擇至少一個 MP3 檔案。' })
    return
  }
  const existing = await readMusicTracks()
  let requestedNames: string[] = []
  try {
    const parsedNames = JSON.parse(typeof request.body?.fileNames === 'string' ? request.body.fileNames : '[]') as unknown
    if (Array.isArray(parsedNames)) requestedNames = parsedNames.filter((name): name is string => typeof name === 'string')
  } catch { requestedNames = [] }
  const knownFingerprints = new Set((await Promise.all(existing.map((track) => fingerprintTrack(track)))).filter((fingerprint): fingerprint is string => Boolean(fingerprint)))
  const accepted: { file: Express.Multer.File; fingerprint: string; displayName: string }[] = []
  for (const [index, file] of files.entries()) {
    const displayName = normalizeUploadedFileName(requestedNames[index] ?? file.originalname)
    const fingerprint = await fingerprintFile(file.path)
    if (knownFingerprints.has(fingerprint) || accepted.some((item) => item.fingerprint === fingerprint)) {
      await fs.unlink(file.path).catch(() => undefined)
      continue
    }
    accepted.push({ file, fingerprint, displayName })
    knownFingerprints.add(fingerprint)
  }
  if (!accepted.length) {
    response.status(409).json({ message: '這些音樂已經存在於播放清單中。' })
    return
  }
  const now = new Date().toISOString()
  const newTracks: MusicTrack[] = accepted.map(({ file, fingerprint, displayName }, index) => {
    return {
    id: crypto.randomUUID(),
    title: pathWithoutExtension(displayName).slice(0, 160) || '未命名音樂',
    fileUrl: `/uploads/${file.filename}`,
    fileName: displayName.slice(0, 240),
    order: existing.length + index,
    createdAt: now,
    fingerprint,
    }
  })
  try {
    await writeMusicTracks([...existing, ...newTracks])
  } catch (error) {
    await Promise.all(accepted.map(({ file }) => fs.unlink(file.path).catch(() => undefined)))
    throw error
  }
  response.status(201).json(newTracks)
})

router.put('/order', requireSameOrigin, requireAuthentication, async (request, response) => {
  const ids = request.body?.ids
  if (!Array.isArray(ids) || ids.length === 0 || ids.some((id) => typeof id !== 'string') || new Set(ids).size !== ids.length) {
    response.status(400).json({ message: '音樂排序資料不正確。' })
    return
  }
  const tracks = await readMusicTracks()
  const byId = new Map(tracks.map((track) => [track.id, track]))
  if (ids.length !== tracks.length || ids.some((id) => !byId.has(id))) {
    response.status(400).json({ message: '音樂清單已變更，請重新整理後再排序。' })
    return
  }
  const updated = ids.map((id, order) => ({ ...byId.get(id) as MusicTrack, order }))
  await writeMusicTracks(updated)
  response.json(updated)
})

router.delete('/:id', requireSameOrigin, requireAuthentication, async (request, response) => {
  const tracks = await readMusicTracks()
  const track = tracks.find((item) => item.id === request.params.id)
  if (!track) { response.status(404).json({ message: '找不到這首音樂。' }); return }
  await writeMusicTracks(tracks.filter((item) => item.id !== track.id).map((item, order) => ({ ...item, order })))
  await removeUnusedUploads(track.fileUrl)
  response.status(204).end()
})

export default router
