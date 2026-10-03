export function boundedText(value: unknown, maxLength: number) {
  return typeof value === 'string' && value.length <= maxLength
}

export function isSafeSocialUrl(value: string) {
  try {
    const parsed = new URL(value)
    return (parsed.protocol === 'https:' || parsed.protocol === 'http:') && value.length <= 2048
  } catch {
    return false
  }
}

export function countWords(content: string) {
  return content.trim() ? content.trim().split(/\s+/u).length : 0
}

export function getAnalyticsDevice(userAgent: string) {
  if (/ipad|tablet/i.test(userAgent)) return 'tablet' as const
  if (/mobile|iphone|ipod|android/i.test(userAgent)) return 'mobile' as const
  return 'desktop' as const
}

export function daysSince(dateString: string) {
  const start = new Date(dateString).getTime()
  return Math.max(0, Math.floor((Date.now() - start) / 86_400_000))
}
