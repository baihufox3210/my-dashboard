import { useEffect } from 'react'
import { unlock } from '../../features/fun/achievements'
import { getPublicPath, getRouteSegments } from '../../routes/routes'

const destinations = [
  { path: '/', label: '首頁' },
  { path: '/about', label: 'About' },
  { path: '/projects', label: 'Projects' },
  { path: '/blog', label: 'Blog' },
  { path: '/friends', label: 'Friends' },
]

function editDistance(a: string, b: string) {
  const row = Array.from({ length: b.length + 1 }, (_unused, index) => index)
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0] ?? 0
    row[0] = i
    for (let j = 1; j <= b.length; j++) {
      const current = row[j] ?? 0
      row[j] = Math.min(current + 1, (row[j - 1] ?? 0) + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1))
      previous = current
    }
  }
  return row[b.length] ?? 0
}

// The lost fox: shown for any path the site does not have, with a guess at what was meant.
function NotFoundPage() {
  const [first = ''] = getRouteSegments()
  useEffect(() => { unlock('lost') }, [])
  const guess = destinations.slice(1).map((item) => ({ ...item, distance: editDistance(first, item.path.slice(1)) })).sort((a, b) => a.distance - b.distance)[0]

  return <main className="main-page honeypot-page">
    <section className="home-panel honeypot-card not-found-card">
      <span className="not-found-fox" aria-hidden="true">🦊<i>🗺️</i></span>
      <p className="home-eyebrow">404 · 狐狸迷路了</p>
      <h1>這裡什麼都沒有</h1>
      <p>狐狸拿著地圖轉了三圈，還是找不到 <code>/{first}</code>。</p>
      {guess && guess.distance <= 3 && <p>你是不是要找：<a href={guess.path}>{guess.label}（{guess.path}）</a></p>}
      <nav className="not-found-links">{destinations.map((item) => <a key={item.path} className="ui-button ui-button-secondary ui-button-small" href={item.path === '/' ? getPublicPath('home') : item.path}>{item.label}</a>)}</nav>
    </section>
  </main>
}

export default NotFoundPage
