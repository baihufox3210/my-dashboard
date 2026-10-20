import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import type { AddressInfo } from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { after, before, describe, test } from 'node:test'

// Configure an isolated data directory before the server modules read their config.
const root = await fs.mkdtemp(path.join(os.tmpdir(), 'dashboard-test-'))
process.env.DATA_DIR = path.join(root, 'data')
process.env.UPLOADS_DIR = path.join(root, 'uploads')
process.env.ADMIN_USERNAME = 'tester'
process.env.ADMIN_PASSWORD = 'correct-horse-battery'
await fs.mkdir(process.env.DATA_DIR, { recursive: true })
await fs.writeFile(path.join(process.env.DATA_DIR, 'security-flags.json'), JSON.stringify({ challenges: { sqlLogin: { enabled: true, flag: 'FLAG{test}' } } }))

const { createApp } = await import('../app.js')
const { sessions } = await import('../security.js')
const { ensureStorage } = await import('../storage.js')
const { createRateLimiter } = await import('../rateLimit.js')
const { isCountyLevelName, locateVisitor } = await import('../geo.js')

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
let base = ''
let cookie = ''
let close: () => Promise<void>

function api(pathname: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  headers.set('Origin', base)
  if (cookie) headers.set('Cookie', cookie)
  return fetch(`${base}${pathname}`, { ...init, headers })
}

function postJson(pathname: string, body: unknown) {
  return api(pathname, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
}

function form(fields: Record<string, string>, files: Record<string, Buffer> = {}) {
  const data = new FormData()
  for (const [key, value] of Object.entries(fields)) data.set(key, value)
  for (const [key, value] of Object.entries(files)) data.set(key, new Blob([value], { type: 'image/png' }), `${key}.png`)
  return data
}

async function uploadExists(url: string | undefined) {
  assert.ok(url?.startsWith('/uploads/'))
  return fs.access(path.join(process.env.UPLOADS_DIR as string, path.basename(url ?? ''))).then(() => true, () => false)
}

before(async () => {
  await ensureStorage(sessions)
  const server = createApp().listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  close = () => new Promise((resolve) => server.close(() => resolve()))
})

after(async () => {
  await close()
  await fs.rm(root, { recursive: true, force: true })
})

describe('auth', () => {
  test('rejects cross-origin and wrong credentials', async () => {
    const crossOrigin = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example' }, body: '{}' })
    assert.equal(crossOrigin.status, 403)
    const wrong = await postJson('/api/auth/login', { username: 'tester', password: 'nope' })
    assert.equal(wrong.status, 401)
  })

  test('solves the SQL challenge without creating a session', async () => {
    const response = await postJson('/api/auth/login', { username: "admin' --", password: 'x' })
    assert.deepEqual(await response.json(), { authenticated: false, challenge: { flag: 'FLAG{test}' } })
    assert.equal(response.headers.get('set-cookie'), null)
  })

  test('a runaway challenge query does not block other requests', async () => {
    const started = Date.now()
    const slow = postJson('/api/auth/login', { username: "' OR (WITH RECURSIVE c(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM c) SELECT max(x) FROM c) --", password: 'x' })
    const quick = await api('/api/server-status')
    assert.equal(quick.status, 200)
    assert.ok(Date.now() - started < 500)
    assert.equal((await slow).status, 401)
  })

  test('logs in with the configured credentials', async () => {
    const response = await postJson('/api/auth/login', { username: 'tester', password: 'correct-horse-battery' })
    assert.equal(response.status, 200)
    cookie = (response.headers.get('set-cookie') ?? '').split(';')[0] ?? ''
    assert.deepEqual(await (await api('/api/auth/me')).json(), { authenticated: true })
  })
})

describe('articles', () => {
  test('lists summaries, serves bodies by id, and cleans up replaced covers', async () => {
    const created = await api('/api/articles', { method: 'POST', body: form({ title: 'Hello', content: '# Title\n\nSome ||secret|| text', tags: 'a, b' }, { coverImage: png }) })
    assert.equal(created.status, 201)
    const article = await created.json() as { id: string; coverImage: string }
    assert.match(article.coverImage, /\.png$/)

    const list = await (await api('/api/articles')).json() as Array<Record<string, unknown>>
    const summary = list.find((item) => item.id === article.id)
    assert.ok(summary)
    assert.equal('content' in summary, false)
    assert.equal(String(summary.excerpt).includes('secret'), false)

    const full = await (await api(`/api/articles/${article.id}`)).json() as { content: string }
    assert.match(full.content, /secret/)

    const updated = await (await api(`/api/articles/${article.id}`, { method: 'PUT', body: form({ title: 'Hello', content: 'New' }, { coverImage: png }) })).json() as { coverImage: string }
    assert.equal(await uploadExists(article.coverImage), false)
    assert.equal(await uploadExists(updated.coverImage), true)

    assert.equal((await api(`/api/articles/${article.id}`, { method: 'DELETE' })).status, 204)
    assert.equal(await uploadExists(updated.coverImage), false)
  })

  test('concurrent writes are all kept', async () => {
    const titles = ['one', 'two', 'three', 'four']
    const responses = await Promise.all(titles.map((title) => api('/api/articles', { method: 'POST', body: form({ title, content: title }) })))
    assert.deepEqual(responses.map((response) => response.status), [201, 201, 201, 201])
    const list = await (await api('/api/articles')).json() as Array<{ title: string }>
    for (const title of titles) assert.ok(list.some((article) => article.title === title))
  })
})

describe('friends', () => {
  test('discards the upload when validation fails', async () => {
    const before = await fs.readdir(process.env.UPLOADS_DIR as string)
    const response = await api('/api/admin/friends', { method: 'POST', body: form({ name: 'Bad', url: 'javascript:alert(1)' }, { avatar: png }) })
    assert.equal(response.status, 400)
    assert.deepEqual(await fs.readdir(process.env.UPLOADS_DIR as string), before)
  })
})

describe('analytics', () => {
  test('records every view, including repeats, with visitor details', async () => {
    const view = { page: 'home', source: 'direct', path: '/', sessionId: 'session-1', referrer: 'www.google.com' }
    assert.equal((await postJson('/api/analytics/view', view)).status, 204)
    assert.equal((await postJson('/api/analytics/view', { ...view, source: undefined, referrer: undefined })).status, 204)
    assert.equal((await postJson('/api/analytics/view', { page: 'nope' })).status, 400)

    const stats = await (await api('/api/admin/analytics?days=1')).json() as {
      totalViews: number; trackedViews: number; uniqueVisitors: number; sessions: number; daily: unknown[]
      sources: { direct: number }; referrers: Array<{ key: string }>; topIps: Array<{ ip: string; views: number }>
    }
    assert.equal(stats.daily.length, 1)
    assert.equal(stats.totalViews, 2)
    assert.equal(stats.trackedViews, 2)
    assert.equal(stats.uniqueVisitors, 1)
    assert.equal(stats.sessions, 1)
    assert.equal(stats.sources.direct, 1)
    assert.deepEqual(stats.referrers.map((item) => item.key), ['www.google.com'])
    assert.deepEqual(stats.topIps.map(({ ip, views }) => ({ ip, views })), [{ ip: '127.0.0.1', views: 2 }])

    const { visits, hasMore } = await (await api('/api/admin/analytics/visits?ip=127.0.0.1')).json() as { visits: Array<{ ip: string; path: string }>; hasMore: boolean }
    assert.equal(visits.length, 2)
    assert.equal(hasMore, false)
    assert.equal(visits[0]?.path, '/')
    assert.equal((await api('/api/admin/analytics/visits?ip=not-an-ip')).status, 400)
  })

  test('ignores location headers from callers that are not the trusted proxy', async () => {
    await api('/api/analytics/view', { method: 'POST', headers: { 'Content-Type': 'application/json', 'CF-IPCountry': 'JP', 'CF-IPCity': 'Tokyo' }, body: JSON.stringify({ page: 'about' }) })
    const { visits } = await (await api('/api/admin/analytics/visits')).json() as { visits: Array<{ page: string; country: string; city: string }> }
    const visit = visits.find((item) => item.page === 'about')
    assert.equal(visit?.country, '')
    assert.equal(visit?.city, '')
  })
})

describe('visitor location', () => {
  test('resolves Taiwanese coordinates to county and township', async () => {
    assert.deepEqual(await locateVisitor('127.0.0.1', { country: 'TW', city: 'Banqiao', latitude: '25.0117', longitude: '121.4659' }), { country: '台灣', region: '新北市', city: '板橋區' })
    assert.deepEqual(await locateVisitor('127.0.0.1', { country: 'TW', city: 'Neihu District', latitude: '25.0689', longitude: '121.591' }), { country: '台灣', region: '台北市', city: '內湖區' })
  })

  test('reports only the county for city-wide default points', async () => {
    assert.equal(isCountyLevelName('Kaohsiung City'), true)
    assert.equal(isCountyLevelName('New-Taipei'), true)
    assert.equal(isCountyLevelName('Toufen Township'), false)
    assert.deepEqual(await locateVisitor('127.0.0.1', { country: 'TW', city: 'Taipei', latitude: '25.033', longitude: '121.565' }), { country: '台灣', region: '台北市', city: '' })
  })

  test('keeps state and city names outside Taiwan and skips private addresses', async () => {
    assert.deepEqual(await locateVisitor('127.0.0.1', { country: 'JP', region: 'Tokyo', city: 'Chiyoda City' }), { country: '日本', region: 'Tokyo', city: 'Chiyoda City' })
    assert.equal(await locateVisitor('127.0.0.1'), null)
    assert.equal((await locateVisitor('8.8.8.8'))?.country, '美國')
  })
})

test('rate limiter counts per key and caps tracked keys', () => {
  const take = createRateLimiter({ windowMs: 1000, max: 2, maxEntries: 1 })
  assert.equal(take('a', 0), 'allowed')
  assert.equal(take('a', 1), 'allowed')
  assert.equal(take('a', 2), 'limited')
  assert.equal(take('b', 3), 'full')
  assert.equal(take('a', 1000), 'allowed')
})
