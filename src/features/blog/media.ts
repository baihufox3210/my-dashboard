export function resolveSameOriginMediaUrl(value: string) {
  if (!value) return ''

  try {
    const url = new URL(value, window.location.origin)
    if (url.origin !== window.location.origin) return ''
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return ''
  }
}

// Inline style that applies an item's saved cover crop (position and zoom).
export function coverImageStyle(item: { coverImagePosition?: string; coverImageScale?: number }) {
  return { objectPosition: item.coverImagePosition ?? '50% 50%', transform: `scale(${item.coverImageScale ?? 1})` }
}
