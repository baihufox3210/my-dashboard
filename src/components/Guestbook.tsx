import { useEffect, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import useEscapeKey from './useEscapeKey'
import { fetchGuestbook, postGuestbookEntry } from '../features/blog/api'
import type { GuestbookEntry, GuestbookMood } from '../features/blog/article'
import { formatRelativeTime, guestbookMoods, nameTint } from '../features/blog/guestbook'

const nameStorageKey = 'guestbook-name'

function readSavedName() {
  try { return localStorage.getItem(nameStorageKey) ?? '' } catch { return '' }
}

function GuestbookMessage({ entry }: { entry: GuestbookEntry }) {
  const mood = guestbookMoods.find((item) => item.id === entry.mood) ?? guestbookMoods[0]
  return <article className="guestbook-entry">
    <span className="guestbook-avatar" style={{ background: nameTint(entry.name) }} aria-hidden="true">{[...entry.name][0]}</span>
    <div className="guestbook-entry-body">
      <header>
        <strong>{entry.name}</strong>
        <span className="guestbook-mood" title={mood?.label}>{mood?.emoji}</span>
        <time dateTime={entry.createdAt} title={new Date(entry.createdAt).toLocaleString('zh-TW')}>{formatRelativeTime(entry.createdAt)}</time>
      </header>
      <p>{entry.message}</p>
      {entry.reply && <div className="guestbook-reply"><small>站長回覆</small><p>{entry.reply}</p></div>}
    </div>
  </article>
}

function GuestbookDialog({ onClose, onCountChange }: { onClose: () => void; onCountChange: (total: number) => void }) {
  const [entries, setEntries] = useState<GuestbookEntry[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState(readSavedName)
  const [message, setMessage] = useState('')
  const [mood, setMood] = useState<GuestbookMood>('wave')
  const [website, setWebsite] = useState('')
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<{ tone: 'error' | 'success'; text: string } | null>(null)
  useEscapeKey(true, onClose, 10)

  useEffect(() => {
    let active = true
    fetchGuestbook()
      .then((page) => { if (active) { setEntries(page.entries); setHasMore(page.hasMore); setTotal(page.total); onCountChange(page.total) } })
      .catch(() => { if (active) setFeedback({ tone: 'error', text: '留言載入失敗，請稍後再試。' }) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [onCountChange])

  async function loadMore() {
    const last = entries.at(-1)
    if (!last) return
    setLoading(true)
    try {
      const page = await fetchGuestbook(last.id)
      setEntries((current) => [...current, ...page.entries])
      setHasMore(page.hasMore)
    } catch {
      setFeedback({ tone: 'error', text: '留言載入失敗，請稍後再試。' })
    } finally {
      setLoading(false)
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setFeedback(null)
    try {
      const entry = await postGuestbookEntry({ name, message, mood, website })
      try { localStorage.setItem(nameStorageKey, name.trim()) } catch { /* storage unavailable */ }
      if (entry.id) {
        setEntries((current) => [entry, ...current])
        setTotal(total + 1)
        onCountChange(total + 1)
      }
      setMessage('')
      setFeedback({ tone: 'success', text: '謝謝你的留言！' })
    } catch (error) {
      setFeedback({ tone: 'error', text: error instanceof Error ? error.message : '留言失敗，請稍後再試。' })
    } finally {
      setBusy(false)
    }
  }

  return <div className="project-modal-backdrop guestbook-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="project-detail-modal guestbook-dialog" role="dialog" aria-modal="true" aria-labelledby="guestbook-title">
      <header className="project-detail-header">
        <p>GUESTBOOK <span>///</span> 訪客留言板</p>
        <button type="button" className="modal-close-button" aria-label="關閉留言板" onClick={onClose}>×</button>
      </header>
      <h2 id="guestbook-title">留下一句話吧</h2>

      <form className="guestbook-form" onSubmit={submit}>
        <div className="guestbook-form-row">
          <input value={name} onChange={(event) => setName(event.target.value)} maxLength={24} placeholder="你的暱稱" aria-label="暱稱" required />
          <div className="guestbook-moods" role="radiogroup" aria-label="心情">
            {guestbookMoods.map((item) => <button key={item.id} type="button" role="radio" aria-checked={mood === item.id} aria-label={item.label} title={item.label} className={mood === item.id ? 'active' : ''} onClick={() => setMood(item.id)}>{item.emoji}</button>)}
          </div>
        </div>
        <textarea value={message} onChange={(event) => setMessage(event.target.value)} maxLength={300} rows={3} placeholder="想對我說些什麼？" aria-label="留言內容" required />
        {/* Hidden from people; bots that fill every field are ignored by the server. */}
        <input className="guestbook-honeypot" value={website} onChange={(event) => setWebsite(event.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true" />
        <div className="guestbook-form-footer">
          <small>{[...message].length} / 300</small>
          {feedback && <span className={`guestbook-feedback is-${feedback.tone}`} role="status">{feedback.text}</span>}
          <button className="ui-button ui-button-primary ui-button-small" disabled={busy || !name.trim() || !message.trim()}>{busy ? '送出中…' : '送出留言'}</button>
        </div>
      </form>

      <div className="guestbook-list" aria-busy={loading}>
        {entries.map((entry) => <GuestbookMessage key={entry.id} entry={entry} />)}
        {!loading && !entries.length && <p className="guestbook-empty">還沒有人留言，來當第一個吧！</p>}
        {hasMore && <button type="button" className="ui-button ui-button-secondary ui-button-small guestbook-more" disabled={loading} onClick={() => void loadMore()}>{loading ? '載入中…' : '看更多留言'}</button>}
      </div>
    </section>
  </div>
}

// Entry point shown beside the social links: opens the guestbook and shows the count.
export function GuestbookButton() {
  const [open, setOpen] = useState(false)
  const [total, setTotal] = useState<number | null>(null)

  useEffect(() => {
    let active = true
    fetchGuestbook().then((page) => { if (active) setTotal(page.total) }).catch(() => undefined)
    return () => { active = false }
  }, [])

  return <>
    <button type="button" className="guestbook-button" aria-label={`開啟留言板${total ? `（${total} 則留言）` : ''}`} title="留言板" onClick={() => setOpen(true)}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 5.5h15a1.5 1.5 0 0 1 1.5 1.5v8.5a1.5 1.5 0 0 1-1.5 1.5H10l-4.5 3.5V17h-1A1.5 1.5 0 0 1 3 15.5V7a1.5 1.5 0 0 1 1.5-1.5Z" /><path d="M7.5 10h9M7.5 13h6" /></svg>
      {total ? <span className="guestbook-count">{total > 99 ? '99+' : total}</span> : null}
      <span className="social-link-name">留言板</span>
    </button>
    {/* Portal: the home cards use backdrop-filter, which would trap a fixed-position dialog inside them. */}
    {open && createPortal(<GuestbookDialog onClose={() => setOpen(false)} onCountChange={setTotal} />, document.body)}
  </>
}
