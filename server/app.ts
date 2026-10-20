import cookieParser from 'cookie-parser'
import express from 'express'
import multer from 'multer'
import { uploadsDirectory } from './config.js'
import { isAuthenticated } from './security.js'
import analyticsRoutes from './routes/analytics.js'
import articleRoutes from './routes/articles.js'
import authRoutes from './routes/auth.js'
import friendRoutes from './routes/friends.js'
import musicRoutes from './routes/music.js'
import projectRoutes from './routes/projects.js'
import publicRoutes from './routes/public.js'
import settingsRoutes from './routes/settings.js'

// Runs authenticated content changes one at a time so concurrent read-modify-write
// requests on the JSON data files cannot overwrite each other.
let contentWriteQueue: Promise<void> = Promise.resolve()
const serializeContentWrites: express.RequestHandler = (request, response, next) => {
  if (request.method === 'GET' || request.method === 'HEAD' || !isAuthenticated(request)) { next(); return }
  const previous = contentWriteQueue
  const finished = new Promise<void>((resolve) => response.once('close', resolve))
  contentWriteQueue = previous.then(() => finished)
  void previous.then(() => { if (!response.writableEnded && !request.destroyed) next() })
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
  app.use('/api/admin', settingsRoutes)
  app.use('/api', analyticsRoutes)
  app.use('/api', publicRoutes)

  app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    void _next
    if (error instanceof multer.MulterError || (error instanceof Error && ['Unsupported image type.', 'Unsupported project file type.', 'Only MP3 files are accepted.'].includes(error.message))) {
      response.status(error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ message: error instanceof Error && error.message === 'Only MP3 files are accepted.' ? '上傳失敗：只接受有效的 MP3，單檔上限 20 MB。' : '上傳失敗：圖片需為有效圖片且小於 8 MB，PDF 須小於 25 MB。' })
      return
    }
    console.error('Unhandled API error:', error)
    response.status(500).json({ message: 'Internal server error.' })
  })

  return app
}
