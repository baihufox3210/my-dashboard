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

  test('turns SQL injection attempts into an easter egg without a session', async () => {
    for (const username of ["admin' --", "' OR 1=1 --", "x' UNION SELECT password FROM users --"]) {
      const response = await postJson('/api/auth/login', { username, password: 'x' })
      assert.deepEqual(await response.json(), { authenticated: false, easterEgg: 'sql-injection', flag: 'FLAG{test}' })
      assert.equal(response.headers.get('set-cookie'), null)
    }
  })

  test('sends admin/admin123 to the scam-panel easter egg', async () => {
    const response = await postJson('/api/auth/login', { username: 'admin', password: 'admin123' })
    assert.deepEqual(await response.json(), { authenticated: false, easterEgg: 'scam-panel' })
    assert.equal(response.headers.get('set-cookie'), null)
  })

  test('no query runs for injection payloads, so even a runaway one answers instantly', async () => {
    const started = Date.now()
    const response = await postJson('/api/auth/login', { username: "' OR (WITH RECURSIVE c(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM c) SELECT max(x) FROM c) --", password: 'x' })
    assert.equal(((await response.json()) as { easterEgg?: string }).easterEgg, 'sql-injection')
    assert.ok(Date.now() - started < 300)
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

test('authenticated JSON writes are not stalled by the write queue', async () => {
  // express.json() consumes the body before the queue runs; the request must still be handled.
  const response = await api('/api/admin/music/order', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: [] }), signal: AbortSignal.timeout(3000) })
  assert.equal(response.status, 400)
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

describe('reader features', () => {
  test('counts Chinese characters as words and estimates reading time', async () => {
    const created = await (await api('/api/articles', { method: 'POST', body: form({ title: '中文 & <XML>', content: '今天天氣很好，我們去 FRC 比賽！' + '字'.repeat(800) }) })).json() as { id: string; wordCount: number; readingMinutes: number }
    assert.equal(created.wordCount, 12 + 800)
    assert.equal(created.readingMinutes, 2)
  })

  test('toggles one reaction per kind per visitor', async () => {
    const [article] = await (await api('/api/articles')).json() as Array<{ id: string }>
    const react = (reaction: string) => postJson(`/api/articles/${article?.id}/reactions`, { reaction }).then((response) => response.json() as Promise<{ counts: Record<string, number>; mine: string[] }>)
    assert.deepEqual(await react('love'), { counts: { like: 0, love: 1, laugh: 0, wow: 0 }, mine: ['love'] })
    assert.deepEqual((await react('love')).counts.love, 0)
    assert.equal((await postJson(`/api/articles/${article?.id}/reactions`, { reaction: 'angry' })).status, 400)
    assert.equal((await postJson('/api/articles/missing/reactions', { reaction: 'like' })).status, 404)
  })

  test('serves an RSS feed with escaped titles and shareable links', async () => {
    const response = await fetch(`${base}/api/rss.xml`)
    assert.match(response.headers.get('content-type') ?? '', /application\/rss\+xml/)
    const xml = await response.text()
    assert.match(xml, /<title>中文 &amp; &lt;XML&gt;<\/title>/)
    assert.match(xml, /<link>http:\/\/127\.0\.0\.1:\d+\/blog\/post\/[0-9a-f-]+<\/link>/)
  })

  test('reports today and lifetime views', async () => {
    const before = await (await fetch(`${base}/api/visits`)).json() as { today: number; total: number }
    await postJson('/api/analytics/view', { page: 'home' })
    const after = await (await fetch(`${base}/api/visits`)).json() as { today: number; total: number }
    assert.deepEqual({ today: after.today - before.today, total: after.total - before.total }, { today: 1, total: 1 })
  })
})

describe('guestbook', () => {
  test('accepts messages, hides IPs, and supports admin reply and delete', async () => {
    const posted = await postJson('/api/guestbook', { name: '  小明 ', message: '你好！\n\n\n\n第一次來', mood: 'heart' })
    assert.equal(posted.status, 201)
    const entry = await posted.json() as { id: string; name: string; message: string; mood: string; ip?: string }
    assert.deepEqual({ name: entry.name, message: entry.message, mood: entry.mood, ip: entry.ip }, { name: '小明', message: '你好！\n\n第一次來', mood: 'heart', ip: undefined })

    const list = await (await fetch(`${base}/api/guestbook`)).json() as { entries: Array<Record<string, unknown>>; total: number }
    assert.equal(list.total, 1)
    assert.equal('ip' in (list.entries[0] ?? {}), false)

    const admin = await (await api('/api/admin/guestbook')).json() as Array<{ ip: string }>
    assert.equal(admin[0]?.ip, '127.0.0.1')

    const replied = await (await api(`/api/admin/guestbook/${entry.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reply: '歡迎！' }) })).json() as { reply: string; repliedAt: string }
    assert.equal(replied.reply, '歡迎！')
    assert.ok(replied.repliedAt)

    assert.equal((await api(`/api/admin/guestbook/${entry.id}`, { method: 'DELETE' })).status, 204)
    assert.equal(((await (await fetch(`${base}/api/guestbook`)).json()) as { total: number }).total, 0)
  })

  test('rejects invalid input, drops honeypot posts, and rate-limits', async () => {
    assert.equal((await postJson('/api/guestbook', { name: '', message: 'hi' })).status, 400)
    assert.equal((await postJson('/api/guestbook', { name: 'a', message: 'x'.repeat(301) })).status, 400)
    assert.equal((await postJson('/api/guestbook', { name: 'a', message: 'http://a http://b http://c' })).status, 400)
    for (const message of ['特選', '你好～', '請問特選?', 'hi 👋']) {
      const response = await postJson('/api/guestbook', { name: 'a', message })
      assert.equal(response.status, 400)
      assert.match(((await response.json()) as { message: string }).message, /不要私訊我只傳個「特選」、「你好」/)
    }
    assert.equal((await postJson('/api/guestbook', { name: 'bot', message: 'spam', website: 'http://spam' })).status, 201)
    assert.equal(((await (await fetch(`${base}/api/guestbook`)).json()) as { total: number }).total, 0)
    // The first test used one of the three posts allowed per 10 minutes.
    assert.equal((await postJson('/api/guestbook', { name: 'a', message: '2' })).status, 201)
    assert.equal((await postJson('/api/guestbook', { name: 'a', message: '3' })).status, 201)
    assert.equal((await postJson('/api/guestbook', { name: 'a', message: '4' })).status, 429)
  })
})

test('counts open tabs from heartbeats', async () => {
  const beat = (sessionId: string) => postJson('/api/presence', { sessionId }).then((response) => response.json() as Promise<{ online: number }>)
  const start = (await (await fetch(`${base}/api/presence`)).json() as { online: number }).online
  assert.equal((await beat('tab-aaaaaaaa')).online, start + 1)
  assert.equal((await beat('tab-aaaaaaaa')).online, start + 1)
  assert.equal((await beat('tab-bbbbbbbb')).online, start + 2)
  assert.equal((await postJson('/api/presence', { sessionId: 'x' })).status, 400)
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
