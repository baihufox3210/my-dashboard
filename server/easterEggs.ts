// Login easter eggs. Nothing here touches a database: inputs are only pattern-matched.

export type LoginEasterEgg = 'scam-panel' | 'sql-injection'

// Classic payloads people try on login forms: quote tricks, tautologies, comments,
// UNION/stacked queries and time-based probes.
const sqlInjectionPatterns = [
  /['"`]\s*(?:or|and|\|\||&&)\s*['"`]?\w*['"`]?\s*(?:=|like|>|<)/i,
  /\b(?:or|and)\s+\d+\s*(?:=|>|<)\s*\d+/i,
  /['"`]\s*(?:--|#|\/\*)/,
  /\bunion\b[\s\S]*\bselect\b/i,
  /;\s*(?:drop|delete|insert|update|select|shutdown)\b/i,
  /\b(?:sleep|benchmark|pg_sleep)\s*\(/i,
  /\bwaitfor\s+delay\b/i,
  /\binformation_schema\b|\bsqlite_master\b/i,
]

export function looksLikeSqlInjection(...values: unknown[]) {
  return values.some((value) => typeof value === 'string' && value.length <= 512 && sqlInjectionPatterns.some((pattern) => pattern.test(value)))
}

export function loginEasterEgg(username: unknown, password: unknown): LoginEasterEgg | undefined {
  if (username === 'admin' && password === 'admin123') return 'scam-panel'
  if (looksLikeSqlInjection(username, password)) return 'sql-injection'
  return undefined
}

// Messages that are nothing but a greeting or "特選" (kept in sync with src/features/fun/memes.ts).
export const lowEffortReply = '不要私訊我只傳個「特選」、「你好」\n這樣真的有夠沒禮貌，免費的服務不是被拿來踐踏的！\n（外面幫別人健檢都可以收1000以上，拜託拿出你們的禮貌）'
const lowEffortWords = /^(?:你好|您好|妳好|哈囉|哈啰|嗨|安安|安|hi|hello|hey|yo|在嗎|在不在|有人嗎|有人在嗎|請問|請問一下|學長|學姊|學姐|學長好|學姊好|學姐好|特選|特殊選才|特選生)+$/

export function isLowEffortGreeting(text: string) {
  const core = text.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')
  return core.length > 0 && core.length <= 16 && lowEffortWords.test(core)
}
