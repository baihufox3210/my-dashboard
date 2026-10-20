import { host, port } from './config.js'
import { createApp } from './app.js'
import { sessions } from './security.js'
import { ensureStorage } from './storage.js'

await ensureStorage(sessions)
const server = createApp().listen(port, host, (error?: Error) => {
  if (error) {
    console.error('API server failed to listen:', error)
    process.exitCode = 1
    return
  }
  console.log(`API server listening on http://localhost:${port}`)
})
server.ref()
