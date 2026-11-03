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
