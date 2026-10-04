import crypto from 'node:crypto'
import type { Request, RequestHandler } from 'express'
import { trustedProxyIp } from './config.js'
import type { AnalyticsRegion } from './types.js'
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

function isTrustedProxyRequest(request: Request) {
  const remoteAddress = request.socket.remoteAddress ?? ''
  return Boolean(trustedProxyIp && (remoteAddress === trustedProxyIp || remoteAddress === `::ffff:${trustedProxyIp}`))
}

export function getClientIp(request: Request) {
  const remoteAddress = request.socket.remoteAddress ?? 'unknown'
  return isTrustedProxyRequest(request) ? request.get('x-real-ip') || remoteAddress : remoteAddress
}

export function getAnalyticsRegion(request: Request): AnalyticsRegion | null {
  if (!isTrustedProxyRequest(request)) return null

  const countryCode = (request.get('cf-ipcountry') ?? request.get('x-geo-country') ?? '').trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(countryCode) || countryCode === 'XX' || countryCode === 'T1') return null

  const country = new Intl.DisplayNames(['zh-TW'], { type: 'region' }).of(countryCode)
  if (!country || country === countryCode) return null

  const rawRegion = request.get('cf-region') ?? request.get('x-geo-region') ?? ''
  const region = [...rawRegion].filter((character) => {
    const code = character.charCodeAt(0)
    return code >= 32 && code !== 127
  }).join('').trim().slice(0, 80) || '未細分'

  return { country, region }
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
