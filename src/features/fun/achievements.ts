// Visitor achievements, kept only in this browser's localStorage.
export type AchievementId =
  | 'first-visit' | 'reader' | 'bookworm' | 'reaction' | 'guestbook' | 'explorer'
  | 'night-owl' | 'dj' | 'avatar-fan' | 'terminal' | 'sudo' | 'konami'
  | 'scam-buster' | 'webshell' | 'bobby-tables' | 'scanner' | 'fox-runner' | 'matrix'
  | 'prompt' | 'rickroll' | 'padoru' | 'lunar-new-year' | 'barrel-roll' | 'vim'
  | 'six-seven' | 'thanos' | 'gravity' | 'dino' | 'life'
  | 'lost' | 'dvd-corner' | 'zerg' | 'snake' | 'console' | 'hacker' | 'sus' | 'nyan' | 'developer' | 'completionist'

// Bonus achievements depend on luck or the clock, so the certificate does not require them.
export type Achievement = { id: AchievementId; emoji: string; title: string; description: string; bonus?: boolean }

export const achievements: Achievement[] = [
  { id: 'first-visit', emoji: '👋', title: '初次見面', description: '第一次來到這個網站' },
  { id: 'reader', emoji: '📖', title: '讀者', description: '讀完第一篇文章' },
  { id: 'bookworm', emoji: '📚', title: '書蟲', description: '讀了三篇不同的文章' },
  { id: 'reaction', emoji: '❤️', title: '有感而發', description: '對文章按下表情回應' },
  { id: 'guestbook', emoji: '✍️', title: '留下足跡', description: '在留言板留言' },
  { id: 'explorer', emoji: '🧭', title: '探險家', description: '逛遍首頁、About、Projects、Blog 與 Friends' },
  { id: 'night-owl', emoji: '🦉', title: '夜貓子', description: '在凌晨 0 點到 5 點之間造訪', bonus: true },
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
  { id: 'prompt', emoji: '🤖', title: 'Show me your prompt', description: '套出了網站的系統提示詞' },
  { id: 'rickroll', emoji: '🕺', title: 'Never gonna give you up', description: '被 Rick Roll 了' },
  { id: 'padoru', emoji: '🎅', title: 'PADORU PADORU', description: '看到狐狸拉著雪橇飛過' },
  { id: 'lunar-new-year', emoji: '🧧', title: '恭喜你發財', description: '在新年期間收到紅包雨' },
  { id: 'barrel-roll', emoji: '🌀', title: 'Do a barrel roll', description: '讓網站轉了一圈' },
  { id: 'vim', emoji: '🚪', title: '逃出 vim', description: '成功離開 vim（真的不容易）' },
  { id: 'six-seven', emoji: '🤷', title: '6 7', description: 'six seven～（手要晃）' },
  { id: 'thanos', emoji: '🫰', title: '無可避免', description: '彈指讓一半的卡片消失' },
  { id: 'gravity', emoji: '🍎', title: '牛頓', description: '讓整個網站掉下來' },
  { id: 'dino', emoji: '🦖', title: '離線也要玩', description: '玩了狐狸跑酷' },
  { id: 'life', emoji: '🧬', title: '生命遊戲', description: '看了 Conway 的生命遊戲' },
  { id: 'lost', emoji: '🗺️', title: '迷路了', description: '走進了不存在的頁面' },
  { id: 'dvd-corner', emoji: '📀', title: '正中角落', description: 'DVD 螢幕保護程式剛好撞進角落', bonus: true },
  { id: 'zerg', emoji: '🐜', title: 'Zerg Rush', description: '擊退了所有吃卡片的 o' },
  { id: 'snake', emoji: '🐍', title: '貪食蛇', description: '在終端機吃到 10 顆果子' },
  { id: 'console', emoji: '🧭', title: '文字冒險家', description: '在 Console 的文字冒險找到白狐' },
  { id: 'hacker', emoji: '💻', title: 'ACCESS GRANTED', description: '在 Hacker Typer 取得權限' },
  { id: 'sus', emoji: 'ඞ', title: 'sus', description: '發現了冒名頂替者' },
  { id: 'nyan', emoji: '🌈', title: 'Nyan 狐', description: '讓彩虹狐狸飛過畫面' },
  { id: 'developer', emoji: '🛠️', title: '開發人員模式', description: '連點網站名稱 7 次' },
  { id: 'completionist', emoji: '🏆', title: '全成就達成', description: '解鎖了所有成就（加分成就除外）' },
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
  if (id !== 'completionist' && !unlocked.completionist && requiredAchievements().every((item) => unlocked[item.id])) {
    unlock('completionist')
    window.dispatchEvent(new Event(completionEvent))
  }
}

export const completionEvent = 'achievements-complete'

export function requiredAchievements() {
  return achievements.filter((item) => !item.bonus && item.id !== 'completionist')
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
