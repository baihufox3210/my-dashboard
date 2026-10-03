import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import express from 'express'
import multer from 'multer'
import path from 'node:path'
import { uploadsDirectory } from './config.js'
import { readProjects } from './storage.js'

export const upload = multer({
  dest: uploadsDirectory,
  limits: { fileSize: 8 * 1024 * 1024, files: 2, fields: 20, fieldSize: 1024 * 1024 },
  fileFilter: (_request, file, callback) => {
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.mimetype)) {
      callback(new Error('Unsupported image type.'))
      return
    }
    callback(null, true)
  },
})

export const projectUpload = multer({
  storage: multer.diskStorage({
    destination: uploadsDirectory,
    filename: (_request, file, callback) => {
      const extension = file.mimetype === 'application/pdf' ? '.pdf'
        : file.mimetype === 'image/jpeg' ? '.jpg'
          : file.mimetype === 'image/png' ? '.png'
            : file.mimetype === 'image/webp' ? '.webp' : '.gif'
      callback(null, `${crypto.randomUUID()}${extension}`)
    },
  }),
  limits: { fileSize: 25 * 1024 * 1024, files: 2, fields: 20, fieldSize: 1024 * 1024 },
  fileFilter: (_request, file, callback) => {
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'].includes(file.mimetype)) {
      callback(new Error('Unsupported project file type.'))
      return
    }
    callback(null, true)
  },
})

export async function validateProjectFiles(request: express.Request, response: express.Response, next: express.NextFunction) {
  const files = request.files as { coverImage?: Express.Multer.File[]; document?: Express.Multer.File[] } | undefined
  const cover = files?.coverImage?.[0]
  const document = files?.document?.[0]
  const removeInvalid = async (message: string) => {
    await removeProjectUploads([cover, document].filter((file): file is Express.Multer.File => Boolean(file)))
    response.status(400).json({ message })
  }
  if (cover) {
    if (cover.size > 8 * 1024 * 1024) { await removeInvalid('封面圖片請限制在 8 MB 以內。'); return }
    const header = await fs.readFile(cover.path).then((buffer) => buffer.subarray(0, 12)).catch(() => Buffer.alloc(0))
    const valid = (header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) || header.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) || (header.toString('ascii', 0, 4) === 'RIFF' && header.toString('ascii', 8, 12) === 'WEBP') || header.toString('ascii', 0, 3) === 'GIF'
    if (!valid) { await removeInvalid('封面必須是有效的 JPEG、PNG、WebP 或 GIF 圖片。'); return }
  }
  if (document) {
    const header = await fs.readFile(document.path).then((buffer) => buffer.subarray(0, 5).toString('ascii')).catch(() => '')
    if (header !== '%PDF-') { await removeInvalid('文件必須是有效的 PDF。'); return }
  }
  next()
}

export async function removeProjectUploads(files: Express.Multer.File[] = []) {
  await Promise.all(files.map((file) => fs.unlink(file.path).catch(() => undefined)))
}

export async function removeProjectAssets(...urls: (string | undefined)[]) {
  const projects = await readProjects()
  const referencedAssets = new Set(projects.flatMap((project) => [project.coverImage, project.documentUrl].filter((url): url is string => Boolean(url))))
  const files = urls.flatMap((url) => {
    if (!url?.startsWith('/uploads/') || referencedAssets.has(url)) return []
    const filename = path.basename(url)
    if (!filename || filename !== url.slice('/uploads/'.length)) return []
    return [path.join(uploadsDirectory, filename)]
  })
  await Promise.all(files.map((file) => fs.unlink(file).catch((error: unknown) => {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  })))
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
    const header = await fs.readFile(file.path).then((buffer) => buffer.subarray(0, 12)).catch(() => Buffer.alloc(0))
    const valid =
      (header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) ||
      header.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
      (header.toString('ascii', 0, 4) === 'RIFF' && header.toString('ascii', 8, 12) === 'WEBP') ||
      header.toString('ascii', 0, 3) === 'GIF'
    if (!valid) {
      await Promise.all(files.map((uploaded) => fs.unlink(uploaded.path).catch(() => undefined)))
      response.status(400).json({ message: 'Only valid JPEG, PNG, WebP, or GIF images are accepted.' })
      return
    }
  }
  next()
}
