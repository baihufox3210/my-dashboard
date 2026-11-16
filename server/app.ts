import cookieParser from 'cookie-parser'
import express from 'express'
import multer from 'multer'
import { uploadsDirectory } from './config.js'
import { isAuthenticated } from './security.js'
import analyticsRoutes from './routes/analytics.js'
import articleRoutes from './routes/articles.js'
import authRoutes from './routes/auth.js'
import friendRoutes from './routes/friends.js'
import { adminGuestbook, publicGuestbook } from './routes/guestbook.js'
import musicRoutes from './routes/music.js'
import presenceRoutes from './routes/presence.js'
import projectRoutes from './routes/projects.js'
import publicRoutes from './routes/public.js'
import seoRoutes from './routes/seo.js'
import shareRoutes from './routes/share.js'
import settingsRoutes from './routes/settings.js'

// Runs authenticated content changes one at a time so concurrent read-modify-write
// requests on the JSON data files cannot overwrite each other.
let contentWriteQueue: Promise<void> = Promise.resolve()
const serializeContentWrites: express.RequestHandler = (request, response, next) => {
  if (request.method === 'GET' || request.method === 'HEAD' || !isAuthenticated(request)) { next(); return }
  const previous = contentWriteQueue
  // Track the response, not the request: Node destroys a request once its body has
  // been read (express.json runs before this), which says nothing about the client.
  let closed = false
  const finished = new Promise<void>((resolve) => response.once('close', () => { closed = true; resolve() }))
  contentWriteQueue = previous.then(() => finished)
  void previous.then(() => { if (!closed) next() })
}

function uploadErrorMessage(error: unknown) {
  if (error instanceof multer.MulterError) {
    switch (error.code) {
      case 'LIMIT_FILE_SIZE': return '上傳失敗：檔案太大（圖片上限 8 MB、PDF 25 MB、MP3 20 MB）。'
      case 'LIMIT_FIELD_VALUE': return '上傳失敗：文字內容太長，請縮短後再試。'
      case 'LIMIT_FILE_COUNT': case 'LIMIT_UNEXPECTED_FILE': return '上傳失敗：檔案數量或欄位不正確。'
      default: return `上傳失敗（${error.code}）。`
    }
  }
  if (!(error instanceof Error)) return undefined
  if (error.message === 'Unsupported image type.') return '上傳失敗：圖片只接受 JPEG、PNG、WebP 或 GIF（HEIC、AVIF 等格式請先轉檔）。'
  if (error.message === 'Unsupported project file type.') return '上傳失敗：只接受 JPEG、PNG、WebP、GIF 圖片或 PDF 文件。'
  if (error.message === 'Only MP3 files are accepted.') return '上傳失敗：只接受有效的 MP3，單檔上限 20 MB。'
  return undefined
}

export function createApp() {
  const app = express()
  app.disable('x-powered-by')
  app.use((_request, response, next) => {
    response.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
      'Content-Security-Policy': "default-src 'none'; media-src 'self'; frame-ancestors 'none';",
    })
    next()
  })
  app.use(express.json({ limit: '1mb' }))
  app.use(cookieParser())
  app.use('/api', (_request, response, next) => {
    response.setHeader('Cache-Control', 'no-store')
    next()
  })
  // Uploaded files get a random name per upload, so their URLs never change content.
  app.use('/uploads', express.static(uploadsDirectory, { maxAge: '365d', immutable: true, index: false }))
  app.use(['/api/admin', '/api/articles'], serializeContentWrites)
  app.use('/api/articles', articleRoutes)
  app.use('/api/auth', authRoutes)
  app.use('/api/admin/projects', projectRoutes)
  app.use('/api/admin/friends', friendRoutes)
  app.use('/api/admin/music', musicRoutes)
  app.use('/api/admin/guestbook', adminGuestbook)
  app.use('/api/guestbook', publicGuestbook)
  app.use('/api/presence', presenceRoutes)
  app.use('/api/admin', settingsRoutes)
  app.use('/api', analyticsRoutes)
  app.use('/api', publicRoutes)
  app.use(seoRoutes)
  app.use(shareRoutes)

  app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    void _next
    const message = uploadErrorMessage(error)
    if (message) {
      response.status(error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ message })
      return
    }
    console.error('Unhandled API error:', error)
    response.status(500).json({ message: 'Internal server error.' })
  })

  return app
}
