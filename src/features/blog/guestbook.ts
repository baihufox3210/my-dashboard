import type { GuestbookMood } from './article'

export const guestbookMoods: { id: GuestbookMood; emoji: string; label: string }[] = [
  { id: 'wave', emoji: '👋', label: '打招呼' },
  { id: 'heart', emoji: '💖', label: '喜歡' },
  { id: 'laugh', emoji: '😆', label: '開心' },
  { id: 'star', emoji: '✨', label: '讚嘆' },
  { id: 'coffee', emoji: '☕', label: '放鬆' },
]

export function formatRelativeTime(value: string) {
  const seconds = Math.max(0, (Date.now() - new Date(value).getTime()) / 1000)
  if (seconds < 60) return '剛剛'
  if (seconds < 3600) return `${Math.floor(seconds / 60)} 分鐘前`
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)} 小時前`
  if (seconds < 30 * 86_400) return `${Math.floor(seconds / 86_400)} 天前`
  return new Date(value).toLocaleDateString('zh-TW')
}

// A stable shade of the theme color per name, so avatars stay on-palette.
export function nameTint(name: string) {
  let hash = 0
  for (const character of name) hash = (hash * 31 + character.codePointAt(0)!) >>> 0
  return `color-mix(in srgb, var(--theme-primary) ${35 + (hash % 6) * 9}%, var(--theme-surface-white))`
}
