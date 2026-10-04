import crypto from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'

const attemptWindowMs = 60_000
const maxAttemptEntries = 5_000
const attempts = new Map<string, { count: number; windowStarted: number }>()

setInterval(() => {
  const now = Date.now()
  for (const [ip, state] of attempts) {
    if (now - state.windowStarted >= attemptWindowMs) attempts.delete(ip)
  }
}, attemptWindowMs).unref()

export function allowSqlLoginChallengeAttempt(ip: string, now: number) {
  const state = attempts.get(ip)
  if (state && now - state.windowStarted < attemptWindowMs) {
    if (state.count >= 20) return false
    state.count += 1
    return true
  }
  if (!state && attempts.size >= maxAttemptEntries) return false
  attempts.set(ip, { count: 1, windowStarted: now })
  return true
}

export function solveSqlLoginChallenge(username: string, password: string) {
  const database = new DatabaseSync(':memory:')
  try {
    database.exec('CREATE TABLE demo_users (username TEXT NOT NULL, password TEXT NOT NULL) STRICT;')
    database.prepare('INSERT INTO demo_users (username, password) VALUES (?, ?)').run('admin', crypto.randomBytes(32).toString('hex'))

    // Intentional injection sink for this CTF challenge only. This throwaway
    // in-memory database contains no production accounts or application data.
    const query = `SELECT username FROM demo_users WHERE username = '${username}' AND password = '${password}'`
    const result = database.prepare(query).get() as { username?: string } | undefined
    return result?.username === 'admin'
  } finally {
    database.close()
  }
}
