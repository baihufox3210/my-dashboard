import { unlock } from './achievements'

export const funEffectEvent = 'fun:effect'
export type FunEffect = 'padoru' | 'newyear' | 'barrel-roll' | 'askew' | 'tableflip'

export function playEffect(effect: FunEffect) {
  window.dispatchEvent(new CustomEvent<FunEffect>(funEffectEvent, { detail: effect }))
}

// Never gonna give you up. Opens the official video in a new tab (the site's CSP does
// not allow embedding third-party frames), so call it from a click or key press.
export function rickroll() {
  unlock('rickroll')
  window.open('https://www.youtube.com/watch?v=dQw4w9WgXcQ', '_blank', 'noopener,noreferrer')
}

// December up to Christmas.
export function isPadoruSeason(date = new Date()) {
  return date.getMonth() === 11 && date.getDate() <= 25
}

// The first fifteen days of the Chinese lunar year (Lantern Festival included).
export function isLunarNewYear(date = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat('zh-TW-u-ca-chinese', { month: 'numeric', day: 'numeric' }).formatToParts(date)
    const month = parts.find((part) => part.type === 'month')?.value ?? ''
    const day = Number(parts.find((part) => part.type === 'day')?.value)
    return /^(?:1|正)月?$/.test(month) && day >= 1 && day <= 15
  } catch {
    return false
  }
}

const zodiac = ['🐀', '🐂', '🐅', '🐇', '🐉', '🐍', '🐎', '🐐', '🐒', '🐓', '🐕', '🐖']

export function lunarYearAnimal(date = new Date()) {
  let year = date.getFullYear()
  try {
    const related = new Intl.DateTimeFormat('zh-TW-u-ca-chinese', { year: 'numeric' }).formatToParts(date).find((part) => (part.type as string) === 'relatedYear')?.value
    if (related) year = Number(related)
  } catch { /* fall back to the Gregorian year */ }
  return zodiac[((year - 4) % 12 + 12) % 12] ?? '🐉'
}
