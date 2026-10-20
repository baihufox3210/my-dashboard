import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import MusicManager from '../../components/MusicManager'
import { fetchAdminSession, loginAdmin, logoutAdmin } from '../../features/blog/api'
import { getAdminPath, getAdminSection, getPublicPath, navigate, useLocationKey, type AdminSection } from '../../routes/routes'
import FriendsSection from './FriendsSection'
import HomeProfileSection from './HomeProfileSection'
import OverviewSection from './OverviewSection'
import SiteSettingsSection from './SiteSettingsSection'
import TrafficSection from './TrafficSection'

const ProjectsPage = lazy(() => import('../ProjectsPage'))

const nav: { id: AdminSection; label: string; mobileLabel: string; icon: string }[] = [
  { id: 'overview', label: '總覽', mobileLabel: '總覽', icon: '⌂' },
  { id: 'home', label: '首頁內容', mobileLabel: '首頁', icon: '◎' },
  { id: 'projects', label: 'Projects', mobileLabel: '作品', icon: '▦' },
  { id: 'friends', label: 'Friends', mobileLabel: '友站', icon: '♧' },
  { id: 'music', label: '音樂管理', mobileLabel: '音樂', icon: '♫' },
  { id: 'traffic', label: '流量分析', mobileLabel: '流量', icon: '◔' },
  { id: 'site', label: '網站設定', mobileLabel: '設定', icon: '⚙' },
]

type AdminPageProps = {
  loginOnly?: boolean
}

function AdminPage({ loginOnly = false }: AdminPageProps) {
  const locationKey = useLocationKey()
  const section = getAdminSection()
  const [authenticated, setAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [challengeFlag, setChallengeFlag] = useState('')
  const handleMessage = useCallback((value: string) => setMessage(value), [])

  // Clear feedback from the previous section whenever the route changes.
  useEffect(() => {
    queueMicrotask(() => setMessage(''))
  }, [locationKey])

  useEffect(() => {
    fetchAdminSession()
      .then(({ authenticated: value }) => {
        setAuthenticated(value)
        if (value && loginOnly) navigate(getAdminPath(), { replace: true })
        if (!value && !loginOnly) navigate('/login', { replace: true })
      })
      .catch(() => {
        setAuthenticated(false)
        if (!loginOnly) navigate('/login', { replace: true })
      })
      .finally(() => setLoading(false))
  }, [loginOnly])

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage('')
    try {
      const result = await loginAdmin(username, password)
      if (result.authenticated) {
        setAuthenticated(true)
        navigate(getAdminPath())
      } else if (result.challenge?.flag) {
        setChallengeFlag(result.challenge.flag)
        setUsername('')
        setPassword('')
      } else {
        setMessage('帳號或密碼不正確。')
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '登入失敗。')
    } finally { setBusy(false) }
  }

  if (loading) return <main className="admin-loading">載入管理後台…</main>
  if (loginOnly && authenticated) return <main className="admin-loading">前往管理後台…</main>
  if (!authenticated && !loginOnly) return <main className="admin-loading">前往登入頁…</main>
  if (!authenticated) return <main className="admin-login-screen"><form className="admin-login-card" onSubmit={handleLogin}>
    <a className="admin-brand" href={getPublicPath('home')}><span className="admin-brand-main">BAIHU</span></a>
    {challengeFlag ? <div className="admin-login-flag" role="status"><code>{challengeFlag}</code></div> : <>
      <p>登入以管理網站內容</p>
      <label>帳號<input autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required /></label>
      <label>密碼<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
      {message && <p className="admin-feedback error" role="alert">{message}</p>}
      <button className="ui-button ui-button-primary" disabled={busy}>{busy ? '登入中…' : '登入後台'}</button>
    </>}
  </form></main>

  const title = section === 'home' ? '首頁內容' : section === 'site' ? '網站設定' : section === 'traffic' ? '流量分析' : section === 'friends' ? 'Friends 管理' : section === 'projects' ? 'Projects 管理' : section === 'music' ? '音樂管理' : '總覽'
  return <main className="admin-app">
    <aside className="admin-rail"><a className="admin-brand" href={getAdminPath()}><span className="admin-brand-main">BAIHU</span></a><nav>{nav.map((item) => <a key={item.id} className={section === item.id ? 'active' : ''} href={getAdminPath(item.id)}><i>{item.icon}</i>{item.label}</a>)}</nav><a className="admin-rail-site" href={getPublicPath('home')}>↗ 查看網站</a></aside>
    <div className="admin-main"><header className="admin-topbar"><div className="admin-topbar-title"><strong>網站管理</strong><span aria-hidden="true">/</span><h1>{title}</h1></div><button className="admin-logout" onClick={() => logoutAdmin().then(() => { setAuthenticated(false); navigate(getPublicPath('home')) }).catch((error: unknown) => setMessage(error instanceof Error ? error.message : '登出失敗。'))}>登出</button></header>
      <nav className="admin-mobile-nav">{nav.map((item) => <a key={item.id} className={section === item.id ? 'active' : ''} href={getAdminPath(item.id)}><i>{item.icon}</i><span className="admin-nav-label-desktop">{item.label}</span><span className="admin-nav-label-mobile">{item.mobileLabel}</span></a>)}</nav>
      <div className="admin-content">
        {message && <p className="admin-feedback">{message}</p>}
        {section === 'overview' && <OverviewSection />}
        {section === 'traffic' && <TrafficSection onMessage={handleMessage} />}
        {section === 'home' && <HomeProfileSection onMessage={handleMessage} />}
        {section === 'friends' && <FriendsSection onMessage={handleMessage} />}
        {section === 'projects' && <Suspense fallback={null}><ProjectsPage embedded /></Suspense>}
        {section === 'music' && <MusicManager onMessage={handleMessage} />}
        {section === 'site' && <SiteSettingsSection onMessage={handleMessage} />}
      </div>
    </div>
  </main>
}

export default AdminPage
