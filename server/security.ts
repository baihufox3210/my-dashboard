import crypto from 'node:crypto'
import type { Request, RequestHandler } from 'express'
import { trustedProxyIp } from './config.js'
import { persistSessions } from './storage.js'

export const sessions = new Map<string, number>()
export const loginFailures = new Map<string, { count: number; windowStarted: number; blockedUntil: number }>()

export function hashSessionId(sessionId: string) {
  return crypto.createHash('sha256').update(sessionId).digest('hex')
}

export function isAuthenticated(request: Request) {
  const sessionId = request.cookies.admin_session as string | undefined
  if (!sessionId) return false
  const sessionHash = hashSessionId(sessionId)
  const expiresAt = sessions.get(sessionHash)
  if (!expiresAt) return false
  if (expiresAt <= Date.now()) {
    sessions.delete(sessionHash)
    void persistSessions(sessions).catch((error: unknown) => console.error('Could not persist admin sessions:', error))
    return false
  }
  return true
}

export function getClientIp(request: Request) {
  const remoteAddress = request.socket.remoteAddress ?? 'unknown'
  const isTrustedProxy = trustedProxyIp && (
    remoteAddress === trustedProxyIp || remoteAddress === `::ffff:${trustedProxyIp}`
  )
  return isTrustedProxy ? request.get('x-real-ip') || remoteAddress : remoteAddress
}

export const requireSameOrigin: RequestHandler = (request, response, next) => {
  const origin = request.get('origin')
  const remoteAddress = request.socket.remoteAddress ?? ''
  const localProxy = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remoteAddress)
  const configuredProxy = trustedProxyIp && (remoteAddress === trustedProxyIp || remoteAddress === `::ffff:${trustedProxyIp}`)
  const forwardedHost = localProxy || configuredProxy ? request.get('x-forwarded-host')?.split(',')[0]?.trim() : undefined
  const host = forwardedHost || request.get('host')
  try {
    if (!origin || !host || new URL(origin).host !== host) throw new Error('Origin mismatch')
  } catch {
    response.status(403).json({ message: 'Request origin is not allowed.' })
    return
  }
  next()
}

export const requireAuthentication: RequestHandler = (request, response, next) => {
  if (!isAuthenticated(request)) {
    response.status(401).json({ message: 'Authentication required.' })
    return
  }
  next()
}
