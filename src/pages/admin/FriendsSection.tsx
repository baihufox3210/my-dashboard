import { useEffect, useState } from 'react'
import ConfirmDialog from '../../components/ConfirmDialog'
import FileDropzone from '../../components/FileDropzone'
import useEscapeKey from '../../components/useEscapeKey'
import { createFriend, deleteFriend, fetchFriends, updateFriend } from '../../features/blog/api'
import type { Friend } from '../../features/blog/article'
import { getPublicPath } from '../../routes/routes'

type SectionProps = { onMessage: (message: string) => void }

function FriendsSection({ onMessage }: SectionProps) {
  const [busy, setBusy] = useState(false)
  const [friends, setFriends] = useState<Friend[]>([])
  const [editingFriend, setEditingFriend] = useState<Friend | null>(null)
  const [friendToDelete, setFriendToDelete] = useState<Friend | null>(null)
  const [friendName, setFriendName] = useState('')
  const [friendIntroduction, setFriendIntroduction] = useState('')
  const [friendUrl, setFriendUrl] = useState('')
  const [friendAvatar, setFriendAvatar] = useState<File | null>(null)
  const [friendModalOpen, setFriendModalOpen] = useState(false)

  useEffect(() => {
    fetchFriends().then(setFriends).catch((error: unknown) => onMessage(error instanceof Error ? error.message : '無法載入後台資料。'))
  }, [onMessage])

  function startFriendEdit(friend?: Friend) {
    setEditingFriend(friend ?? null); setFriendName(friend?.name ?? ''); setFriendIntroduction(friend?.introduction ?? ''); setFriendUrl(friend?.url ?? ''); setFriendAvatar(null); setFriendModalOpen(true); onMessage('')
  }

  function closeFriendModal() {
    if (busy) return
    setFriendModalOpen(false); setEditingFriend(null); setFriendName(''); setFriendIntroduction(''); setFriendUrl(''); setFriendAvatar(null)
  }

  useEscapeKey(friendModalOpen, closeFriendModal, 10)

  async function saveFriend(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); onMessage('')
    const form = new FormData(); form.set('name', friendName); form.set('introduction', friendIntroduction); form.set('url', friendUrl)
    if (friendAvatar) form.set('avatar', friendAvatar)
    try {
      const saved = editingFriend ? await updateFriend(editingFriend.id, form) : await createFriend(form)
      setFriends((current) => editingFriend ? current.map((item) => item.id === saved.id ? saved : item) : [...current, saved])
      setFriendModalOpen(false); setEditingFriend(null); setFriendName(''); setFriendIntroduction(''); setFriendUrl(''); setFriendAvatar(null)
      onMessage(editingFriend ? '朋友資料已更新。' : '朋友已新增。')
    } catch (error) { onMessage(error instanceof Error ? error.message : '儲存失敗。') }
    finally { setBusy(false) }
  }

  async function removeFriend(friend: Friend) {
    setBusy(true); onMessage('')
    try { await deleteFriend(friend.id); setFriends((current) => current.filter((item) => item.id !== friend.id)); setFriendToDelete(null); onMessage(`已刪除「${friend.name}」。`) }
    catch (error) { onMessage(error instanceof Error ? error.message : '刪除失敗。') }
    finally { setBusy(false) }
  }

  return <>
    <section className="admin-friends-manager">
          <div className="admin-friends-heading"><div><p className="admin-kicker">FRIENDS DIRECTORY</p><h2>朋友連結</h2><p>管理公開 Friends 頁面上的人物卡片。</p></div><div className="admin-friends-actions"><a className="ui-button ui-button-primary" href={getPublicPath('friends')} target="_blank" rel="noreferrer">預覽頁面 ↗</a><button type="button" className="ui-button ui-button-primary" onClick={() => startFriendEdit()}>＋ 新增朋友</button></div></div>
          <div className="admin-friend-list">{friends.length ? friends.map((friend) => <article key={friend.id}>{friend.avatarUrl ? <img loading="lazy" decoding="async" src={friend.avatarUrl} alt="" /> : <span className="admin-friend-avatar-fallback">{friend.name.slice(0, 1)}</span>}<div><strong>{friend.name}</strong><p>{friend.introduction || '尚未填寫自介'}</p><a href={friend.url} target="_blank" rel="noreferrer">{friend.url}</a></div><div className="admin-friend-actions"><button type="button" className="ui-button ui-button-secondary ui-button-small" onClick={() => startFriendEdit(friend)}>編輯</button><button type="button" className="ui-button ui-button-danger ui-button-small" disabled={busy} onClick={() => setFriendToDelete(friend)}>刪除</button></div></article>) : <p className="admin-friend-empty">尚未新增朋友，建立第一張卡片吧。</p>}</div>
          {friendModalOpen && <div className="friend-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeFriendModal() }}><section className="friend-modal" role="dialog" aria-modal="true" aria-labelledby="friend-modal-title"><header className="friend-modal-heading"><div><p className="admin-kicker">FRIENDS DIRECTORY</p><h2 id="friend-modal-title">{editingFriend ? '編輯朋友' : '新增朋友'}</h2></div><button type="button" className="friend-modal-close" aria-label="關閉" onClick={closeFriendModal}>×</button></header>
            <form className="admin-friend-form" onSubmit={saveFriend}><div className="admin-form-grid"><div className="admin-field span-two">頭像 <FileDropzone title="上傳朋友頭像" file={friendAvatar} previewUrl={editingFriend?.avatarUrl} onFile={setFriendAvatar} /></div>
              <label className="admin-field">名稱<input required maxLength={120} value={friendName} onChange={(event) => setFriendName(event.target.value)} placeholder="朋友名稱" /></label>
              <label className="admin-field">網站連結<input required type="url" value={friendUrl} onChange={(event) => setFriendUrl(event.target.value)} placeholder="https://example.com" /></label>
              <label className="admin-field span-two">自我介紹 <small>最多 1000 字</small><textarea rows={3} maxLength={1000} value={friendIntroduction} onChange={(event) => setFriendIntroduction(event.target.value)} placeholder="簡單介紹一下這位朋友…" /></label>
            </div><div className="friend-modal-footer"><button type="button" className="ui-button ui-button-secondary" disabled={busy} onClick={closeFriendModal}>取消</button><button className="ui-button ui-button-primary" disabled={busy}>{busy ? '儲存中…' : editingFriend ? '儲存編輯' : '新增朋友'}</button></div></form>
          </section></div>}
        </section>
    <ConfirmDialog
      open={Boolean(friendToDelete)}
      title="刪除這位朋友？"
      message={friendToDelete ? `「${friendToDelete.name}」刪除後將無法復原。` : ''}
      busy={busy}
      onConfirm={() => friendToDelete ? removeFriend(friendToDelete) : undefined}
      onCancel={() => { if (!busy) setFriendToDelete(null) }}
    />
  </>
}

export default FriendsSection
