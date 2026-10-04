import crypto from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'

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
