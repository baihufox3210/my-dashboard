import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import express from 'express'
import multer from 'multer'
import path from 'node:path'
import { uploadsDirectory } from './config.js'
import { readArticles, readFriends, readHomeProfile, readMusicTracks, readProjects, readSiteSettings } from './storage.js'

const imageMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const
const projectMimeTypes = [...imageMimeTypes, 'application/pdf'] as const
const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
const mp3MimeTypes = ['audio/mpeg', 'audio/mp3'] as const

function isValidImageHeader(header: Buffer) {
  return (header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) ||
    header.subarray(0, 8).equals(pngSignature) ||
    (header.toString('ascii', 0, 4) === 'RIFF' && header.toString('ascii', 8, 12) === 'WEBP') ||
    header.toString('ascii', 0, 3) === 'GIF'
}

async function readHeader(file: Express.Multer.File, length: number) {
  let handle: fs.FileHandle | undefined
  try {
    handle = await fs.open(file.path, 'r')
    const { buffer, bytesRead } = await handle.read(Buffer.alloc(length), 0, length, 0)
    return buffer.subarray(0, bytesRead)
  } catch {
    return Buffer.alloc(0)
  } finally {
    await handle?.close()
  }
}

function uploadPath(url: string | undefined) {
  if (!url?.startsWith('/uploads/')) return undefined
  const filename = path.basename(url)
  if (!filename || filename !== url.slice('/uploads/'.length)) return undefined
  return path.join(uploadsDirectory, filename)
}

async function unlinkIfPresent(file: string) {
  await fs.unlink(file).catch((error: unknown) => {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  })
}

async function readReferencedUploads() {
  const [articles, projects, friends, music, settings, profile] = await Promise.all([
    readArticles(), readProjects(), readFriends(), readMusicTracks(), readSiteSettings(), readHomeProfile(),
  ])
  return new Set([
    ...articles.map((article) => article.coverImage),
    ...projects.flatMap((project) => [project.coverImage, project.documentUrl]),
    ...friends.map((friend) => friend.avatarUrl),
    ...music.map((track) => track.fileUrl),
    settings.avatarUrl, settings.backgroundUrl, profile.avatarUrl,
  ].filter((url): url is string => Boolean(url)))
}

// Deletes uploaded files that are no longer referenced by any stored content.
export async function removeUnusedUploads(...urls: (string | undefined)[]) {
  const candidates = urls.filter((url): url is string => Boolean(uploadPath(url)))
  if (!candidates.length) return
  const referenced = await readReferencedUploads()
  await Promise.all(candidates.filter((url) => !referenced.has(url)).map((url) => unlinkIfPresent(uploadPath(url) as string)))
}

const extensions: Record<string, string> = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif', 'application/pdf': '.pdf' }

// Random names keep uploads unguessable and cacheable; the extension lets the static
// server send the right Content-Type.
const randomNameStorage = multer.diskStorage({
  destination: uploadsDirectory,
  filename: (_request, file, callback) => callback(null, `${crypto.randomUUID()}${extensions[file.mimetype] ?? ''}`),
})

export const upload = multer({
  storage: randomNameStorage,
  limits: { fileSize: 8 * 1024 * 1024, files: 2, fields: 20, fieldSize: 1024 * 1024 },
  fileFilter: (_request, file, callback) => {
    if (!imageMimeTypes.includes(file.mimetype as typeof imageMimeTypes[number])) {
      callback(new Error('Unsupported image type.'))
      return
    }
    callback(null, true)
  },
})

export const musicUpload = multer({
  storage: multer.diskStorage({
    destination: uploadsDirectory,
    filename: (_request, _file, callback) => callback(null, `${crypto.randomUUID()}.mp3`),
  }),
  limits: { fileSize: 20 * 1024 * 1024, files: 20, fields: 10 },
  fileFilter: (_request, file, callback) => {
    if (!mp3MimeTypes.includes(file.mimetype as typeof mp3MimeTypes[number]) && !file.originalname.toLowerCase().endsWith('.mp3')) {
      callback(new Error('Only MP3 files are accepted.'))
      return
    }
    callback(null, true)
  },
})

export const projectUpload = multer({
  storage: randomNameStorage,
  limits: { fileSize: 25 * 1024 * 1024, files: 2, fields: 20, fieldSize: 1024 * 1024 },
  fileFilter: (_request, file, callback) => {
    if (!projectMimeTypes.includes(file.mimetype as typeof projectMimeTypes[number])) {
      callback(new Error('Unsupported project file type.'))
      return
    }
    callback(null, true)
  },
})

export async function validateMusicFiles(
  request: express.Request,
  response: express.Response,
  next: express.NextFunction,
) {
  const files = Array.isArray(request.files) ? request.files : []
  for (const file of files) {
    const header = await readHeader(file, 3)
    const hasId3Header = header.toString('ascii', 0, 3) === 'ID3'
    const hasMpegFrame = header.length >= 2 && header[0] === 0xff && (header[1] & 0xe0) === 0xe0
    if (!hasId3Header && !hasMpegFrame) {
      await Promise.all(files.map((uploaded) => fs.unlink(uploaded.path).catch(() => undefined)))
      response.status(400).json({ message: '音樂檔案必須是有效的 MP3。' })
      return
    }
  }
  next()
}

export async function validateProjectFiles(request: express.Request, response: express.Response, next: express.NextFunction) {
  const files = request.files as { coverImage?: Express.Multer.File[]; document?: Express.Multer.File[] } | undefined
  const cover = files?.coverImage?.[0]
  const document = files?.document?.[0]
  const removeInvalid = async (message: string) => {
    await discardUploadedFiles([cover, document].filter((file): file is Express.Multer.File => Boolean(file)))
    response.status(400).json({ message })
  }
  if (cover) {
    if (cover.size > 8 * 1024 * 1024) { await removeInvalid('封面圖片請限制在 8 MB 以內。'); return }
    const header = await readHeader(cover, 12)
    if (!isValidImageHeader(header)) { await removeInvalid('封面必須是有效的 JPEG、PNG、WebP 或 GIF 圖片。'); return }
  }
  if (document) {
    const header = await readHeader(document, 5)
    if (header.toString('ascii') !== '%PDF-') { await removeInvalid('文件必須是有效的 PDF。'); return }
  }
  next()
}

export async function discardUploadedFiles(files: Express.Multer.File[] = []) {
  await Promise.all(files.map((file) => fs.unlink(file.path).catch(() => undefined)))
}

export async function validateUploadedImages(
  request: express.Request,
  response: express.Response,
  next: express.NextFunction,
) {
  const files = [
    ...(request.file ? [request.file] : []),
    ...(Array.isArray(request.files) ? request.files : Object.values(request.files ?? {}).flat()),
  ]
  for (const file of files) {
    const header = await readHeader(file, 12)
    if (!isValidImageHeader(header)) {
      await Promise.all(files.map((uploaded) => fs.unlink(uploaded.path).catch(() => undefined)))
      response.status(400).json({ message: 'Only valid JPEG, PNG, WebP, or GIF images are accepted.' })
      return
    }
  }
  next()
}

export function uploadedFiles(request: express.Request) {
  return [
    ...(request.file ? [request.file] : []),
    ...(Array.isArray(request.files) ? request.files : Object.values(request.files ?? {}).flat()),
  ]
}
