import { Router } from 'express'
import { createRateLimiter } from '../rateLimit.js'
import { getClientIp, requireSameOrigin } from '../security.js'

// Open tabs send a heartbeat every 30 seconds; a tab counts as online for 70 seconds
// after its last one. Kept in memory only, so a restart simply starts from zero.
const onlineWindowMs = 70_000
const maxTabs = 5_000
const lastSeen = new Map<string, number>()
const takeHeartbeat = createRateLimiter({ windowMs: 60_000, max: 12, maxEntries: 10_000 })

function onlineCount(now = Date.now()) {
  for (const [id, seen] of lastSeen) if (now - seen > onlineWindowMs) lastSeen.delete(id)
  return lastSeen.size
}

const router = Router()

router.get('/', (_request, response) => {
  response.json({ online: onlineCount() })
})

router.post('/', requireSameOrigin, (request, response) => {
  const id = (request.body as { sessionId?: unknown } | undefined)?.sessionId
  if (typeof id !== 'string' || !/^[A-Za-z0-9-]{8,64}$/.test(id)) { response.status(400).json({ message: 'Invalid session.' }); return }
  if (takeHeartbeat(getClientIp(request)) !== 'allowed') { response.status(429).json({ message: 'Too many heartbeats.' }); return }
  const now = Date.now()
  if (lastSeen.has(id) || onlineCount(now) < maxTabs) lastSeen.set(id, now)
  response.json({ online: onlineCount(now) })
})

export default router
