import crypto from 'node:crypto'
import { Router } from 'express'
import { createRateLimiter } from '../rateLimit.js'
import { getClientIp, requireAuthentication, requireSameOrigin } from '../security.js'
import { readGuestbook, updateGuestbook } from '../storage.js'
import type { GuestbookEntry, GuestbookMood } from '../types.js'

const moods: GuestbookMood[] = ['wave', 'heart', 'laugh', 'star', 'coffee']
const maxEntries = 1000
const pageSize = 20
const takePost = createRateLimiter({ windowMs: 10 * 60_000, max: 3, maxEntries: 5_000 })

function cleanText(value: unknown, maxLength: number, multiline: boolean) {
  if (typeof value !== 'string') return undefined
  const text = [...value.normalize('NFC')].filter((character) => {
    const code = character.charCodeAt(0)
    return (multiline && character === '\n') || (code >= 32 && code !== 127)
  }).join('').replace(/\n{3,}/g, '\n\n').trim()
  return text && [...text].length <= maxLength ? text : undefined
}

// Visitors never see IP addresses.
function publicEntry({ ip: _ip, ...entry }: GuestbookEntry) {
  void _ip
  return entry
}

export const publicGuestbook = Router()

publicGuestbook.get('/', async (request, response) => {
  const entries = await readGuestbook()
  const before = typeof request.query.before === 'string' ? request.query.before : ''
  const start = before ? entries.findIndex((entry) => entry.id === before) + 1 : 0
  const page = start > 0 || !before ? entries.slice(start, start + pageSize) : []
  response.json({ entries: page.map(publicEntry), total: entries.length, hasMore: start + pageSize < entries.length })
})

publicGuestbook.post('/', requireSameOrigin, async (request, response) => {
  const body = (request.body ?? {}) as Record<string, unknown>
  // A hidden form field that people leave empty and naive bots fill in.
  if (typeof body.website === 'string' && body.website.trim()) {
    response.status(201).json({ ok: true })
    return
  }
  const name = cleanText(body.name, 24, false)
  const message = cleanText(body.message, 300, true)
  const mood = moods.includes(body.mood as GuestbookMood) ? body.mood as GuestbookMood : 'wave'
  if (!name || !message) {
    response.status(400).json({ message: '請填寫暱稱（24 字內）與留言（300 字內）。' })
    return
  }
  if ((message.match(/https?:\/\//gi)?.length ?? 0) > 2) {
    response.status(400).json({ message: '留言中的連結太多了。' })
    return
  }
  const ip = getClientIp(request).replace(/^::ffff:(?=\d+\.\d+\.\d+\.\d+$)/, '')
  if (takePost(ip) !== 'allowed') {
    response.status(429).json({ message: '留言太頻繁了，請稍後再試。' })
    return
  }
  const entry: GuestbookEntry = { id: crypto.randomUUID(), name, message, mood, createdAt: new Date().toISOString(), ip }
  await updateGuestbook((entries) => ({ entries: [entry, ...entries].slice(0, maxEntries), result: undefined }))
  response.status(201).json(publicEntry(entry))
})

export const adminGuestbook = Router()

adminGuestbook.get('/', requireAuthentication, async (_request, response) => {
  response.json(await readGuestbook())
})

adminGuestbook.put('/:id', requireSameOrigin, requireAuthentication, async (request, response) => {
  const raw = (request.body as { reply?: unknown } | undefined)?.reply
  const reply = raw === '' ? '' : cleanText(raw, 500, true)
  if (reply === undefined) {
    response.status(400).json({ message: '回覆需為 500 字以內的文字。' })
    return
  }
  const updated = await updateGuestbook((entries) => {
    const index = entries.findIndex((entry) => entry.id === request.params.id)
    const existing = entries[index]
    if (!existing) return { entries, result: undefined }
    const { reply: _reply, repliedAt: _repliedAt, ...rest } = existing
    void _reply; void _repliedAt
    const next: GuestbookEntry = reply ? { ...rest, reply, repliedAt: new Date().toISOString() } : rest
    entries[index] = next
    return { entries, result: next }
  })
  if (!updated) { response.status(404).json({ message: '找不到這則留言。' }); return }
  response.json(updated)
})

adminGuestbook.delete('/:id', requireSameOrigin, requireAuthentication, async (request, response) => {
  const removed = await updateGuestbook((entries) => {
    const remaining = entries.filter((entry) => entry.id !== request.params.id)
    return { entries: remaining, result: remaining.length !== entries.length }
  })
  if (!removed) { response.status(404).json({ message: '找不到這則留言。' }); return }
  response.status(204).end()
})
