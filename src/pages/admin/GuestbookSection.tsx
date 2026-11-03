import { useEffect, useState } from 'react'
import ConfirmDialog from '../../components/ConfirmDialog'
import { deleteGuestbookEntry, fetchAdminGuestbook, replyGuestbookEntry } from '../../features/blog/api'
import type { AdminGuestbookEntry } from '../../features/blog/article'
import { formatRelativeTime, guestbookMoods, nameTint } from '../../features/blog/guestbook'

type SectionProps = { onMessage: (message: string) => void }

function GuestbookSection({ onMessage }: SectionProps) {
  const [entries, setEntries] = useState<AdminGuestbookEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [busyId, setBusyId] = useState('')
  const [toDelete, setToDelete] = useState<AdminGuestbookEntry | null>(null)

  useEffect(() => {
    fetchAdminGuestbook()
      .then(setEntries)
      .catch((error: unknown) => onMessage(error instanceof Error ? error.message : '無法載入留言。'))
      .finally(() => setLoading(false))
  }, [onMessage])

  async function saveReply(entry: AdminGuestbookEntry) {
    setBusyId(entry.id)
    try {
      const saved = await replyGuestbookEntry(entry.id, (drafts[entry.id] ?? entry.reply ?? '').trim())
      setEntries((current) => current.map((item) => item.id === saved.id ? saved : item))
      setDrafts(({ [entry.id]: _saved, ...rest }) => { void _saved; return rest })
      onMessage(saved.reply ? `已回覆「${entry.name}」。` : `已移除對「${entry.name}」的回覆。`)
    } catch (error) {
      onMessage(error instanceof Error ? error.message : '回覆失敗。')
    } finally {
      setBusyId('')
    }
  }

  async function confirmDelete() {
    if (!toDelete) return
    setBusyId(toDelete.id)
    try {
      await deleteGuestbookEntry(toDelete.id)
      setEntries((current) => current.filter((item) => item.id !== toDelete.id))
      onMessage(`已刪除「${toDelete.name}」的留言。`)
      setToDelete(null)
    } catch (error) {
      onMessage(error instanceof Error ? error.message : '刪除失敗。')
    } finally {
      setBusyId('')
    }
  }

  return <section className="admin-guestbook">
    <div className="admin-friends-heading"><div><p className="admin-kicker">GUESTBOOK</p><h2>訪客留言</h2><p>首頁留言板的所有留言，由新到舊；IP 只有你看得到。</p></div><strong className="admin-guestbook-total">{entries.length} 則</strong></div>
    {loading ? <p className="admin-friend-empty">載入中…</p> : entries.length ? <div className="admin-guestbook-list">{entries.map((entry) => {
      const draft = drafts[entry.id] ?? entry.reply ?? ''
      const changed = draft.trim() !== (entry.reply ?? '')
      return <article key={entry.id}>
        <span className="guestbook-avatar" style={{ background: nameTint(entry.name) }} aria-hidden="true">{[...entry.name][0]}</span>
        <div>
          <header>
            <strong>{entry.name}</strong>
            <span>{guestbookMoods.find((mood) => mood.id === entry.mood)?.emoji}</span>
            <code>{entry.ip}</code>
            <time dateTime={entry.createdAt} title={new Date(entry.createdAt).toLocaleString('zh-TW')}>{formatRelativeTime(entry.createdAt)}</time>
          </header>
          <p>{entry.message}</p>
          <textarea rows={2} maxLength={500} value={draft} placeholder="回覆這則留言（留空則不顯示回覆）" aria-label={`回覆 ${entry.name}`} onChange={(event) => setDrafts((current) => ({ ...current, [entry.id]: event.target.value }))} />
          <div className="admin-guestbook-actions">
            <button type="button" className="ui-button ui-button-primary ui-button-small" disabled={!changed || busyId === entry.id} onClick={() => void saveReply(entry)}>{busyId === entry.id ? '儲存中…' : '儲存回覆'}</button>
            <button type="button" className="ui-button ui-button-danger ui-button-small" disabled={busyId === entry.id} onClick={() => setToDelete(entry)}>刪除</button>
          </div>
        </div>
      </article>
    })}</div> : <p className="admin-friend-empty">還沒有留言。</p>}
    <ConfirmDialog
      open={Boolean(toDelete)}
      title="刪除這則留言？"
      message={toDelete ? `「${toDelete.name}」的留言刪除後將無法復原。` : ''}
      busy={Boolean(busyId)}
      onConfirm={confirmDelete}
      onCancel={() => { if (!busyId) setToDelete(null) }}
    />
  </section>
}

export default GuestbookSection
