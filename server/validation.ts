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

export function getAnalyticsDevice(userAgent: string) {
  if (/ipad|tablet/i.test(userAgent)) return 'tablet' as const
  if (/mobile|iphone|ipod|android/i.test(userAgent)) return 'mobile' as const
  return 'desktop' as const
}

// Coarse browser and OS labels for the analytics dashboard.
export function parseUserAgent(userAgent: string) {
  const browser = /bot|crawl|spider|slurp|preview|headless/i.test(userAgent) ? 'Bot'
    : /edg(e|a|ios)?\//i.test(userAgent) ? 'Edge'
      : /opr\/|opera/i.test(userAgent) ? 'Opera'
        : /samsungbrowser/i.test(userAgent) ? 'Samsung Internet'
          : /firefox|fxios/i.test(userAgent) ? 'Firefox'
            : /chrome|crios|chromium/i.test(userAgent) ? 'Chrome'
              : /safari/i.test(userAgent) ? 'Safari'
                : userAgent ? '其他' : '未知'
  const os = /windows/i.test(userAgent) ? 'Windows'
    : /iphone|ipad|ipod/i.test(userAgent) ? 'iOS'
      : /android/i.test(userAgent) ? 'Android'
        : /mac os x|macintosh/i.test(userAgent) ? 'macOS'
          : /cros/i.test(userAgent) ? 'ChromeOS'
            : /linux/i.test(userAgent) ? 'Linux'
              : userAgent ? '其他' : '未知'
  return { browser, os }
}

export function daysSince(dateString: string) {
  const start = new Date(dateString).getTime()
  return Math.max(0, Math.floor((Date.now() - start) / 86_400_000))
}

export type CoverSettings = { coverImagePosition?: string; coverImageScale?: number }

// Parses optional cover position ("x% y%", each 0-100) and scale (1-3) from a request body;
// returns null when either is present but invalid.
export function parseCoverSettings(value: unknown): CoverSettings | null {
  if (!value || typeof value !== 'object') return null
  const body = value as Record<string, unknown>
  const position = body.coverImagePosition
  const rawScale = body.coverImageScale
  const scale = typeof rawScale === 'string' && rawScale.trim() ? Number(rawScale) : rawScale

  if (position !== undefined) {
    if (typeof position !== 'string') return null
    const match = /^(\d{1,3}(?:\.\d{1,2})?)%\s+(\d{1,3}(?:\.\d{1,2})?)%$/.exec(position)
    if (!match || Number(match[1]) > 100 || Number(match[2]) > 100) return null
  }
  if (scale !== undefined && (typeof scale !== 'number' || !Number.isFinite(scale) || scale < 1 || scale > 3)) return null

  return {
    ...(typeof position === 'string' ? { coverImagePosition: position } : {}),
    ...(typeof scale === 'number' ? { coverImageScale: scale } : {}),
  }
}
