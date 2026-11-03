import { unlock } from './achievements'

export const funEffectEvent = 'fun:effect'

// Messages that are nothing but a greeting or "特選" (kept in sync with server/easterEggs.ts).
export const lowEffortReply = '不要私訊我只傳個「特選」、「你好」\n這樣真的有夠沒禮貌，免費的服務不是被拿來踐踏的！\n（外面幫別人健檢都可以收1000以上，拜託拿出你們的禮貌）'
const lowEffortWords = /^(?:你好|您好|妳好|哈囉|哈啰|嗨|安安|安|hi|hello|hey|yo|在嗎|在不在|有人嗎|有人在嗎|請問|請問一下|學長|學姊|學姐|學長好|學姊好|學姐好|特選|特殊選才|特選生)+$/

export function isLowEffortGreeting(text: string) {
  const core = text.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')
  return core.length > 0 && core.length <= 16 && lowEffortWords.test(core)
}
export type FunEffect = 'padoru' | 'newyear' | 'barrel-roll' | 'askew' | 'tableflip' | 'six-seven' | 'snap' | 'gravity' | 'blink' | 'dino' | 'life' | 'zerg' | 'sus' | 'nyan' | 'fireworks'

// Android-style short message at the bottom of the screen.
export const funToastEvent = 'fun:toast'
export function showToast(text: string) {
  window.dispatchEvent(new CustomEvent<string>(funToastEvent, { detail: text }))
}

export function isAprilFools(date = new Date()) {
  return date.getMonth() === 3 && date.getDate() === 1
}

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

// `rm -rf /` in the terminal: the whole page goes black, like the machine just died.
// Nothing is stored, so reloading the page brings everything back.
export function isRmRfRoot(text: string) {
  const words = text.trim().split(/\s+/)
  if (words[0] === 'sudo') words.shift()
  if (words.shift() !== 'rm') return false
  const flags = words.filter((word) => word.startsWith('-'))
  const targets = words.filter((word) => !word.startsWith('-'))
  const recursive = flags.some((flag) => /^-[a-z]*r/.test(flag) || flag === '--recursive')
  return recursive && targets.length > 0 && targets.every((target) => target === '/' || target === '/*')
}

export function crashSite() {
  const root = document.documentElement
  if (root.classList.contains('fun-crashed')) return
  document.querySelectorAll<HTMLMediaElement>('audio, video').forEach((media) => media.pause())
  const screen = document.createElement('div')
  screen.className = 'fun-crash-screen'
  screen.setAttribute('role', 'alert')
  const cursor = document.createElement('span')
  cursor.className = 'fun-crash-cursor'
  const hint = document.createElement('p')
  hint.textContent = '（重新整理頁面即可復原）'
  screen.append(cursor, hint)
  // Outside <body>, which is hidden entirely while crashed.
  root.append(screen)
  root.classList.add('fun-crashed')
  // The page is "dead": swallow keys so hidden shortcuts don't fire, but leave the
  // browser's own reload keys alone (no preventDefault).
  window.addEventListener('keydown', (event) => event.stopImmediatePropagation(), true)
}
