import type { Request } from 'express'
import { siteUrl } from './config.js'
import { isTrustedProxyRequest } from './security.js'

// Public address of the site for absolute links. SITE_URL wins; otherwise it is
// derived from the request (honouring the trusted proxy's forwarded protocol).
export function siteOrigin(request: Request) {
  if (siteUrl) return siteUrl
  const forwardedProto = isTrustedProxyRequest(request) ? request.get('x-forwarded-proto')?.split(',')[0]?.trim() : undefined
  return `${forwardedProto === 'https' ? 'https' : request.protocol}://${request.get('host') ?? 'localhost'}`
}

export function escapeXml(value: string) {
  return value.replace(/[<>&'"]/g, (character) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[character] ?? character)
}

export function escapeHtml(value: string) {
  return value.replace(/[<>&'"]/g, (character) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&#39;', '"': '&quot;' })[character] ?? character)
}
