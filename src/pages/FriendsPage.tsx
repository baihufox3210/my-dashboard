import { useEffect, useState } from 'react'
import { fetchFriends } from '../features/blog/api'
import type { Friend } from '../features/blog/article'

function FriendsPage() {
  const [friends, setFriends] = useState<Friend[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => { fetchFriends().then(setFriends).catch(() => setFriends([])).finally(() => setLoading(false)) }, [])

  return <main className="friends-page">
    {loading ? <p className="friends-empty">載入中…</p> : friends.length ? <div className="friends-grid">{friends.map((friend) => <a className="friend-card" href={friend.url} key={friend.id} target="_blank" rel="noreferrer">
      <span className="friend-avatar-frame">{friend.avatarUrl ? <img className="friend-avatar" src={friend.avatarUrl} alt={`${friend.name} 頭像`} /> : <span className="friend-avatar friend-avatar-fallback" aria-hidden="true">{friend.name.slice(0, 1)}</span>}</span>
      <span className="friend-card-copy"><strong className="friend-name">{friend.name}</strong><span className="friend-introduction">{friend.introduction || '來看看我的網站吧。'}</span><span className="friend-link"><span>{new URL(friend.url).hostname.replace(/^www\./, '')}</span><span className="friend-card-arrow" aria-hidden="true">✦</span></span></span>
    </a>)}</div> : <div className="friends-empty"><span>✳</span><strong>朋友名單正在準備中</strong><p>喜歡的創作者與網站會在這裡和你分享。</p></div>}
  </main>
}

export default FriendsPage
