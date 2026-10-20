export type RateLimitResult = 'allowed' | 'limited' | 'full'

// Fixed-window request counter per key. `full` means the key table reached its cap
// and a new key was refused, which keeps memory bounded under many distinct clients.
export function createRateLimiter({ windowMs, max, maxEntries }: { windowMs: number; max: number; maxEntries: number }) {
  const windows = new Map<string, { count: number; windowStarted: number }>()

  setInterval(() => {
    const now = Date.now()
    for (const [key, value] of windows) {
      if (now - value.windowStarted >= windowMs) windows.delete(key)
    }
  }, windowMs).unref()

  return (key: string, now = Date.now()): RateLimitResult => {
    const current = windows.get(key)
    if (current && now - current.windowStarted < windowMs) {
      if (current.count >= max) return 'limited'
      current.count += 1
      return 'allowed'
    }
    if (!current && windows.size >= maxEntries) return 'full'
    windows.set(key, { count: 1, windowStarted: now })
    return 'allowed'
  }
}
