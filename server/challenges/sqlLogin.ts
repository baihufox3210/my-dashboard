import { spawn } from 'node:child_process'

const attemptWindowMs = 60_000
const maxAttemptEntries = 5_000
const challengeTimeoutMs = 1_000
const maxConcurrentChallenges = 4
const attempts = new Map<string, { count: number; windowStarted: number }>()
let runningChallenges = 0

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

// The query runs in a short-lived child process: node:sqlite is synchronous, so a
// crafted payload (e.g. an unbounded recursive CTE) would otherwise block the API's
// event loop. A killed process also releases any memory SQLite allocated.
const challengeScript = `
const crypto = require('node:crypto')
const { DatabaseSync } = require('node:sqlite')
let input = ''
process.stdin.setEncoding('utf8')
process.stdin.on('data', (chunk) => { input += chunk })
process.stdin.on('end', () => {
  const { username, password } = JSON.parse(input)
  const database = new DatabaseSync(':memory:')
  database.exec('PRAGMA hard_heap_limit = 33554432;')
  database.exec('CREATE TABLE demo_users (username TEXT NOT NULL, password TEXT NOT NULL) STRICT;')
  database.prepare('INSERT INTO demo_users (username, password) VALUES (?, ?)').run('admin', crypto.randomBytes(32).toString('hex'))

  // Intentional injection sink for this CTF challenge only. This throwaway
  // in-memory database contains no production accounts or application data.
  const query = "SELECT username FROM demo_users WHERE username = '" + username + "' AND password = '" + password + "'"
  const result = database.prepare(query).get()
  process.stdout.write(result && result.username === 'admin' ? 'solved' : 'failed')
})
`

export function solveSqlLoginChallenge(username: string, password: string): Promise<boolean> {
  if (runningChallenges >= maxConcurrentChallenges) return Promise.resolve(false)
  runningChallenges += 1
  return new Promise<boolean>((resolve) => {
    const child = spawn(process.execPath, ['--no-warnings', '-e', challengeScript], {
      env: {},
      stdio: ['pipe', 'pipe', 'ignore'],
      timeout: challengeTimeoutMs,
      killSignal: 'SIGKILL',
    })
    let output = ''
    child.stdout.setEncoding('utf8')
    child.stdout.on('data', (chunk: string) => { output = (output + chunk).slice(0, 16) })
    child.stdin.on('error', () => undefined)
    child.on('error', () => resolve(false))
    child.on('close', (code) => resolve(code === 0 && output === 'solved'))
    child.stdin.end(JSON.stringify({ username, password }))
  }).finally(() => { runningChallenges -= 1 })
}
