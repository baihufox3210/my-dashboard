import crypto from 'node:crypto'
import { isIP } from 'node:net'
import type { Request, RequestHandler } from 'express'
import { trustedProxyIp } from './config.js'
import { persistSessions } from './storage.js'

export const sessions = new Map<string, number>()
export const loginFailures = new Map<string, { count: number; windowStarted: number; blockedUntil: number }>()

setInterval(() => {
  const now = Date.now()
  let removed = false
  for (const [sessionId, expiresAt] of sessions) {
    if (expiresAt <= now) { sessions.delete(sessionId); removed = true }
  }
  if (removed) void persistSessions(sessions).catch((error: unknown) => console.error('Could not persist admin sessions:', error))
}, 60 * 60 * 1000).unref()

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

function isTrustedProxyRequest(request: Request) {
  const remoteAddress = request.socket.remoteAddress ?? ''
  return Boolean(trustedProxyIp && (remoteAddress === trustedProxyIp || remoteAddress === `::ffff:${trustedProxyIp}`))
}

export function getClientIp(request: Request) {
  const remoteAddress = request.socket.remoteAddress ?? 'unknown'
  if (!isTrustedProxyRequest(request)) return remoteAddress

  const forwardedAddress = request.get('x-real-ip')?.trim()
  return forwardedAddress && isIP(forwardedAddress) ? forwardedAddress : remoteAddress
}

// Location headers set by the trusted reverse proxy (Cloudflare or a custom GeoIP
// module); ignored for any other caller so visitors cannot spoof them.
export function getProxyLocationHeaders(request: Request) {
  if (!isTrustedProxyRequest(request)) return {}
  const header = (...names: string[]) => names.map((name) => request.get(name)?.trim()).find(Boolean)
  return {
    country: header('cf-ipcountry', 'x-geo-country'),
    region: header('cf-region', 'x-geo-region'),
    city: header('cf-ipcity', 'x-geo-city'),
    latitude: header('cf-iplatitude', 'x-geo-latitude'),
    longitude: header('cf-iplongitude', 'x-geo-longitude'),
  }
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
