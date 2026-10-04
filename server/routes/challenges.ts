import fs from 'node:fs/promises'
import { Router } from 'express'
import { securityFlagsFile } from '../config.js'
import { getClientIp, requireSameOrigin } from '../security.js'
import { solveSqlLoginChallenge } from '../challenges/sqlLogin.js'

const router = Router()

const attemptWindowMs = 60_000
const maxAttemptEntries = 5_000
const attempts = new Map<string, { count: number; windowStarted: number }>()

setInterval(() => {
  const now = Date.now()
  for (const [ip, state] of attempts) {
    if (now - state.windowStarted >= attemptWindowMs) attempts.delete(ip)
  }
}, attemptWindowMs).unref()

type SqlLoginConfig = { enabled: boolean; flag: string }

async function readSqlLoginConfig(): Promise<SqlLoginConfig> {
  try {
    const raw = JSON.parse(await fs.readFile(securityFlagsFile, 'utf8')) as unknown
    if (!raw || typeof raw !== 'object') throw new Error('Invalid security challenge flags.')
    const challenge = (raw as Record<string, unknown>).challenges
    if (!challenge || typeof challenge !== 'object') throw new Error('Invalid security challenge flags.')
    const sqlLogin = (challenge as Record<string, unknown>).sqlLogin
    if (!sqlLogin || typeof sqlLogin !== 'object') throw new Error('Invalid security challenge flags.')
    const { enabled, flag } = sqlLogin as Record<string, unknown>
    if (typeof enabled !== 'boolean' || typeof flag !== 'string' || flag.length > 128 || (enabled && !flag.trim())) {
      throw new Error('Invalid security challenge flags.')
    }
    return { enabled, flag }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.error('SQL login challenge configuration is invalid; disabling challenge.')
    }
    return { enabled: false, flag: '' }
  }
}

function allowAttempt(ip: string, now: number) {
  const state = attempts.get(ip)
  if (state && now - state.windowStarted < attemptWindowMs) {
    if (state.count >= 20) return false
    state.count += 1
    return true
  }
  if (!state && attempts.size >= maxAttemptEntries) return false
  attempts.set(ip, { count: 1, windowStarted: now })
  return true
}

router.get('/sql-login', async (_request, response) => {
  const config = await readSqlLoginConfig()
  response.json({ enabled: config.enabled })
})

router.post('/sql-login', requireSameOrigin, async (request, response) => {
  const config = await readSqlLoginConfig()
  if (!config.enabled) {
    response.status(404).json({ message: 'Challenge not found.' })
    return
  }

  const username = request.body?.username
  const password = request.body?.password
  if (typeof username !== 'string' || typeof password !== 'string' || username.length > 256 || password.length > 256) {
    response.status(400).json({ message: 'Invalid challenge input.' })
    return
  }

  if (!allowAttempt(getClientIp(request), Date.now())) {
    response.status(429).json({ message: 'Too many challenge attempts.' })
    return
  }

  const solved = (() => {
    try { return solveSqlLoginChallenge(username, password) }
    catch { return false }
  })()
  if (!solved) {
    response.status(401).json({ success: false, message: '帳號或密碼不正確。' })
    return
  }

  response.json({ success: true, flag: config.flag })
})

export default router
