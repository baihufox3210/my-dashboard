import path from 'node:path'
import { fileURLToPath } from 'node:url'
import 'dotenv/config'

const currentFile = fileURLToPath(import.meta.url)
const currentDirectory = path.dirname(currentFile)
export const projectDirectory = path.resolve(currentDirectory, '..')
export const dataDirectory = path.join(projectDirectory, 'data')
export const articlesFile = path.join(dataDirectory, 'articles.json')
export const siteSettingsFile = path.join(dataDirectory, 'site-settings.json')
export const homeProfileFile = path.join(dataDirectory, 'home-profile.json')
export const sessionsFile = path.join(dataDirectory, 'admin-sessions.json')
export const analyticsFile = path.join(dataDirectory, 'analytics.json')
export const activityFile = path.join(dataDirectory, 'admin-activity.json')
export const friendsFile = path.join(dataDirectory, 'friends.json')
export const projectsFile = path.join(dataDirectory, 'projects.json')
export const musicFile = path.join(dataDirectory, 'music.json')
export const uploadsDirectory = path.join(projectDirectory, 'public', 'uploads')

export const sessionLifetimeMs = 24 * 60 * 60 * 1000
export const port = Number(process.env.PORT ?? 3001)
export const host = process.env.API_HOST ?? '127.0.0.1'
export const trustedProxyIp = process.env.TRUSTED_PROXY_IP
export const adminUsername = process.env.ADMIN_USERNAME
export const adminPassword = process.env.ADMIN_PASSWORD
export const siteStartDate = process.env.SITE_START_DATE ?? new Date().toISOString()

if (!adminUsername || !adminPassword || adminPassword.length < 8 || adminUsername === 'admin' || adminPassword === 'change-me') {
  throw new Error('Set ADMIN_USERNAME and a unique ADMIN_PASSWORD of at least 8 characters before starting the server.')
}
