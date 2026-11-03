import { useEffect } from 'react'
import { unlock } from '../../features/fun/achievements'
import { getPublicPath, getRouteSegments } from '../../routes/routes'

const fakeEnv = `DB_HOST=localhost
DB_PASSWORD=nice_try
AWS_SECRET_ACCESS_KEY=please_dont
ADMIN_PASSWORD=hunter2
FLAG=去首頁按 \` 鍵，問問終端機吧 🦊`

// Shown for the paths vulnerability scanners probe. There is nothing behind them.
function HoneypotPage() {
  const [path = ''] = getRouteSegments()
  useEffect(() => { unlock('scanner') }, [])
  const target = path === '.env' ? '.env' : path.includes('php') ? 'phpMyAdmin' : path === '.git' ? '.git' : 'WordPress'

  return <main className="main-page honeypot-page">
    <section className="home-panel honeypot-card">
      <span className="honeypot-fox" aria-hidden="true">🦊</span>
      <p className="home-eyebrow">404 · BUT MAKE IT FOX</p>
      <h1>你在找 {target} 嗎？</h1>
      <p>這裡沒有 WordPress、沒有 phpMyAdmin，也沒有外洩的 <code>.env</code>。<br />只有一隻狐狸，正在看著你的掃描器。</p>
      {path === '.env' && <pre className="honeypot-env">{fakeEnv}</pre>}
      <a className="ui-button ui-button-primary" href={getPublicPath('home')}>回到首頁</a>
    </section>
  </main>
}

export default HoneypotPage
