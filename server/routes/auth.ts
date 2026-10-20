import crypto from 'node:crypto'
import { Router } from 'express'
import { readSqlLoginChallengeConfig } from '../challenges/config.js'
import { allowSqlLoginChallengeAttempt, solveSqlLoginChallenge } from '../challenges/sqlLogin.js'
import { adminPassword, adminUsername, sessionLifetimeMs } from '../config.js'
import { getClientIp, hashSessionId, isAuthenticated, loginFailures, requireSameOrigin, sessions } from '../security.js'
import { persistSessions } from '../storage.js'

const router = Router()

router.get('/me', (request, response) => {
  response.json({ authenticated: isAuthenticated(request) })
})

function credentialMatches(value: unknown, expected: string) {
  if (typeof value !== 'string') return false
  const digest = (input: string) => crypto.createHash('sha256').update(input).digest()
  return crypto.timingSafeEqual(digest(value), digest(expected))
}

router.post('/login', requireSameOrigin, async (request, response) => {
  const ip = getClientIp(request)
  let failure = loginFailures.get(ip)
  if (failure && Date.now() - failure.windowStarted > 15 * 60_000 && failure.blockedUntil <= Date.now()) {
    loginFailures.delete(ip)
    failure = undefined
  }
  if (failure && failure.blockedUntil > Date.now()) {
    response.set('Retry-After', String(Math.ceil((failure.blockedUntil - Date.now()) / 1000)))
    response.status(429).json({ message: 'Too many login attempts. Try again later.' })
    return
  }
  const body = request.body && typeof request.body === 'object' ? request.body as { username?: unknown; password?: unknown } : {}
  const username = body.username
  const password = body.password

  const usernameMatches = credentialMatches(username, adminUsername as string)
  const passwordMatches = credentialMatches(password, adminPassword as string)
  if (!usernameMatches || !passwordMatches) {
    const challengeConfig = await readSqlLoginChallengeConfig()
    if (challengeConfig.enabled && typeof username === 'string' && typeof password === 'string' && username.length <= 256 && password.length <= 256) {
      if (!allowSqlLoginChallengeAttempt(ip, Date.now())) {
        response.status(429).json({ message: 'Too many login attempts. Try again later.' })
        return
      }
      const challengeSolved = await solveSqlLoginChallenge(username, password)
      if (challengeSolved) {
        response.json({ authenticated: false, challenge: { flag: challengeConfig.flag } })
        return
      }
    }

    const nextCount = (failure?.count ?? 0) + 1
    const now = Date.now()
    for (const [key, value] of loginFailures) {
      if (value.windowStarted + 15 * 60_000 < now && value.blockedUntil <= now) loginFailures.delete(key)
    }
    if (!loginFailures.has(ip) && loginFailures.size >= 5000) {
      const oldestKey = loginFailures.keys().next().value
      if (oldestKey) loginFailures.delete(oldestKey)
    }
    loginFailures.set(ip, {
      count: nextCount,
      windowStarted: failure?.windowStarted ?? now,
      blockedUntil: nextCount >= 5 ? now + 15 * 60_000 : 0,
    })
    response.status(401).json({ message: 'Invalid username or password.' })
    return
  }
  loginFailures.delete(ip)

  const sessionId = crypto.randomBytes(32).toString('hex')
  const now = Date.now()
  for (const [sessionHash, expiresAt] of sessions) {
    if (expiresAt <= now) sessions.delete(sessionHash)
  }
  sessions.set(hashSessionId(sessionId), now + sessionLifetimeMs)
  await persistSessions(sessions)
  response.cookie('admin_session', sessionId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: request.get('origin')?.startsWith('https://') === true,
    path: '/',
    maxAge: sessionLifetimeMs,
  })
  response.json({ authenticated: true })
})

router.post('/logout', requireSameOrigin, async (request, response) => {
  const sessionId = request.cookies.admin_session as string | undefined
  if (sessionId && sessions.delete(hashSessionId(sessionId))) await persistSessions(sessions)
  response.clearCookie('admin_session', { httpOnly: true, sameSite: 'lax', path: '/' })
  response.json({ authenticated: false })
})

export default router
