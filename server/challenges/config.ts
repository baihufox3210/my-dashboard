import fs from 'node:fs/promises'
import { securityFlagsFile } from '../config.js'

export type SqlLoginChallengeConfig = { enabled: boolean; flag: string }

export async function readSqlLoginChallengeConfig(): Promise<SqlLoginChallengeConfig> {
  try {
    const raw = JSON.parse(await fs.readFile(securityFlagsFile, 'utf8')) as unknown
    if (!raw || typeof raw !== 'object') throw new Error('Invalid security challenge flags.')
    const challenges = (raw as Record<string, unknown>).challenges
    if (!challenges || typeof challenges !== 'object') throw new Error('Invalid security challenge flags.')
    const sqlLogin = (challenges as Record<string, unknown>).sqlLogin
    if (!sqlLogin || typeof sqlLogin !== 'object') throw new Error('Invalid security challenge flags.')
    const { enabled, flag } = sqlLogin as Record<string, unknown>
    if (typeof enabled !== 'boolean' || typeof flag !== 'string' || flag.length > 128 || (enabled && !flag.trim())) {
      throw new Error('Invalid security challenge flags.')
    }
    return { enabled, flag }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.error('SQL login challenge configuration is invalid; disabling challenge.')
    }
    return { enabled: false, flag: '' }
  }
}
