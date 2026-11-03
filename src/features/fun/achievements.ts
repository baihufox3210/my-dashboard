// Visitor achievements, kept only in this browser's localStorage.
export type AchievementId =
  | 'first-visit' | 'reader' | 'bookworm' | 'reaction' | 'guestbook' | 'explorer'
  | 'night-owl' | 'dj' | 'avatar-fan' | 'terminal' | 'sudo' | 'konami'
  | 'scam-buster' | 'webshell' | 'bobby-tables' | 'scanner' | 'fox-runner' | 'matrix'

export type Achievement = { id: AchievementId; emoji: string; title: string; description: string }

export const achievements: Achievement[] = [
  { id: 'first-visit', emoji: '👋', title: '初次見面', description: '第一次來到這個網站' },
  { id: 'reader', emoji: '📖', title: '讀者', description: '讀完第一篇文章' },
  { id: 'bookworm', emoji: '📚', title: '書蟲', description: '讀了三篇不同的文章' },
  { id: 'reaction', emoji: '❤️', title: '有感而發', description: '對文章按下表情回應' },
  { id: 'guestbook', emoji: '✍️', title: '留下足跡', description: '在留言板留言' },
  { id: 'explorer', emoji: '🧭', title: '探險家', description: '逛遍首頁、About、Projects、Blog 與 Friends' },
  { id: 'night-owl', emoji: '🦉', title: '夜貓子', description: '在凌晨 0 點到 5 點之間造訪' },
  { id: 'dj', emoji: '🎧', title: 'DJ', description: '播放網站上的音樂' },
  { id: 'avatar-fan', emoji: '🦊', title: '頭像粉絲', description: '連續點了頭像 10 次' },
  { id: 'terminal', emoji: '⌨️', title: '駭客模式', description: '打開隱藏的終端機' },
  { id: 'sudo', emoji: '🛡️', title: '權限不足', description: '在終端機嘗試 sudo' },
  { id: 'konami', emoji: '🎮', title: '老玩家', description: '輸入了 Konami Code' },
  { id: 'scam-buster', emoji: '🚓', title: '打詐英雄', description: '闖進了詐騙集團的後台' },
  { id: 'webshell', emoji: '🐚', title: '後門專家', description: '在詐騙後台植入了（假的）後門' },
  { id: 'bobby-tables', emoji: '💉', title: 'Bobby Tables', description: '嘗試 SQL 注入登入頁' },
  { id: 'scanner', emoji: '🔍', title: '掃描器', description: '找了不存在的 WordPress 或 .env' },
  { id: 'fox-runner', emoji: '🏃', title: '狐狸快跑', description: '在鍵盤上打出 fox' },
  { id: 'matrix', emoji: '🟩', title: '紅藥丸', description: '在終端機進入 Matrix' },
]

const storageKey = 'achievements'
const progressKey = 'achievement-progress'
export const achievementEvent = 'achievement-unlocked'
export const matrixEvent = 'matrix:start'

function readJson<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) ?? 'null') as T ?? fallback } catch { return fallback }
}

function writeJson(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* storage unavailable */ }
}

export function unlockedAchievements(): Record<string, string> {
  return readJson<Record<string, string>>(storageKey, {})
}

export function unlock(id: AchievementId) {
  const unlocked = unlockedAchievements()
  if (unlocked[id]) return
  unlocked[id] = new Date().toISOString()
  writeJson(storageKey, unlocked)
  const achievement = achievements.find((item) => item.id === id)
  if (achievement) window.dispatchEvent(new CustomEvent<Achievement>(achievementEvent, { detail: achievement }))
}

// Adds `value` to a named set and unlocks `id` once the set reaches `target` entries.
export function trackProgress(name: string, value: string, target: number, id: AchievementId) {
  const progress = readJson<Record<string, string[]>>(progressKey, {})
  const values = new Set(progress[name] ?? [])
  values.add(value)
  progress[name] = [...values]
  writeJson(progressKey, progress)
  if (values.size >= target) unlock(id)
}
