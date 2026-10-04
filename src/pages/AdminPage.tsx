import { useCallback, useEffect, useRef, useState } from 'react'

import FileDropzone from '../components/FileDropzone'
import ConfirmDialog from '../components/ConfirmDialog'
import MusicManager from '../components/MusicManager'
import useEscapeKey from '../components/useEscapeKey'
import ProjectsPage from './ProjectsPage'
import { applySiteBackground } from '../features/blog/background'
import {
  fetchAdminSession,
  fetchAdminActivity,
  fetchAnalyticsStats,
  fetchArticles,
  fetchArticleStats,
  fetchHomeProfile,
  fetchFriends,
  fetchSiteSettings,
  loginAdmin,
  logoutAdmin,
  attemptSqlLoginChallenge,
  fetchSqlLoginChallengeStatus,
  updateHomeProfile,
  createFriend,
  updateFriend,
  deleteFriend,
  updateSiteSettings,
} from '../features/blog/api'
import type { AnalyticsStats, Article, ArticleStats, Friend, HomeProfile, SiteSettings } from '../features/blog/article'
import type { AdminActivity } from '../features/blog/api'
import { getAdminPath, getAdminSection, getPublicPath } from '../routes/routes'

type Section = 'overview' | 'home' | 'site' | 'traffic' | 'friends' | 'projects' | 'music' | 'login'
type BackgroundViewport = 'desktop' | 'mobile'
const blankProfile: HomeProfile = { name: '', introduction: '', quote: '', socials: [], tags: [], avatarMessages: [], updateTitle: '', updateText: '' }
const blankSettings: SiteSettings = { siteName: '', biography: '', experience: '', backgroundPositionX: 50, backgroundPositionY: 50, backgroundDesktopPositionX: 50, backgroundDesktopPositionY: 50, backgroundMobilePositionX: 50, backgroundMobilePositionY: 50 }
const blankStats: ArticleStats = { articleCount: 0, categoryCount: 0, tagCount: 0, totalWords: 0, runtimeDays: 0, lastActivity: null }
const blankAnalytics: AnalyticsStats = { days: 7, totalViews: 0, previousViews: 0, regionCount: 0, topRegions: [], daily: [], topPages: [], topArticles: [], sources: { direct: 0, search: 0, social: 0, referral: 0 }, devices: { mobile: 0, tablet: 0, desktop: 0 } }

function routeSection(): Section {
  return getAdminSection()
}

type AdminPageProps = {
  loginOnly?: boolean
}

function AdminPage({ loginOnly = false }: AdminPageProps) {
  const [section, setSection] = useState<Section>(routeSection)
  const [authenticated, setAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [challengeAvailable, setChallengeAvailable] = useState(false)
  const [challengeMode, setChallengeMode] = useState(false)
  const [challengeFlag, setChallengeFlag] = useState('')
  const [stats, setStats] = useState(blankStats)
  const [articles, setArticles] = useState<Article[]>([])
  const [activity, setActivity] = useState<AdminActivity[]>([])
  const [analytics, setAnalytics] = useState(blankAnalytics)
  const [analyticsDays, setAnalyticsDays] = useState<7 | 30>(7)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [analyticsRefresh, setAnalyticsRefresh] = useState(0)
  const [profile, setProfile] = useState(blankProfile)
  const [settings, setSettings] = useState(blankSettings)
  const [friends, setFriends] = useState<Friend[]>([])
  const [editingFriend, setEditingFriend] = useState<Friend | null>(null)
  const [friendToDelete, setFriendToDelete] = useState<Friend | null>(null)
  const [friendName, setFriendName] = useState('')
  const [friendIntroduction, setFriendIntroduction] = useState('')
  const [friendUrl, setFriendUrl] = useState('')
  const [friendAvatar, setFriendAvatar] = useState<File | null>(null)
  const [friendModalOpen, setFriendModalOpen] = useState(false)
  const [socials, setSocials] = useState('')
  const [tags, setTags] = useState('')
  const [avatarMessages, setAvatarMessages] = useState('')
  const [avatar, setAvatar] = useState<File | null>(null)
  const [background, setBackground] = useState<File | null>(null)
  const [backgroundPreview, setBackgroundPreview] = useState('')
  const handleMusicMessage = useCallback((value: string) => setMessage(value), [])

  const [backgroundDragging, setBackgroundDragging] = useState(false)
  const [backgroundAdjustOpen, setBackgroundAdjustOpen] = useState(false)
  const [backgroundViewport, setBackgroundViewport] = useState<BackgroundViewport>('desktop')
  const previewFrameRef = useRef<HTMLDivElement>(null)
  const previewImageRef = useRef<HTMLImageElement>(null)
  const pointerStartRef = useRef<{ pointerId: number; x: number; y: number; positionX: number; positionY: number; overflowX: number; overflowY: number; active: boolean } | null>(null)
  const backgroundPositionLabelRef = useRef<HTMLSpanElement>(null)
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => { if (holdTimerRef.current) clearTimeout(holdTimerRef.current) }, [])

  useEffect(() => {
    let active = true
    if (!background) {
      queueMicrotask(() => { if (active) setBackgroundPreview('') })
      return () => { active = false }
    }
    const url = URL.createObjectURL(background)
    queueMicrotask(() => { if (active) setBackgroundPreview(url) })
    return () => { active = false; URL.revokeObjectURL(url) }
  }, [background])

  useEffect(() => {
    const sync = () => { setSection(routeSection()); setMessage('') }
    window.addEventListener('popstate', sync)
    window.addEventListener('hashchange', sync)
    return () => {
      window.removeEventListener('popstate', sync)
      window.removeEventListener('hashchange', sync)
    }
  }, [])

  useEffect(() => {
    if (!loginOnly) return
    let active = true
    fetchSqlLoginChallengeStatus()
      .then(({ enabled }) => { if (active) setChallengeAvailable(enabled) })
      .catch(() => { if (active) setChallengeAvailable(false) })
    return () => { active = false }
  }, [loginOnly])

  useEffect(() => {
    fetchAdminSession()
      .then(({ authenticated: value }) => {
        setAuthenticated(value)
        if (value && loginOnly) window.location.replace(getAdminPath())
        if (!value && !loginOnly) window.location.replace('/login')
      })
      .catch(() => {
        setAuthenticated(false)
        if (!loginOnly) window.location.replace('/login')
      })
      .finally(() => setLoading(false))
  }, [loginOnly])

  useEffect(() => {
    if (!authenticated) return
    Promise.all([fetchArticleStats(), fetchHomeProfile(), fetchSiteSettings(), fetchFriends()]).then(([loadedStats, loadedProfile, loadedSettings, loadedFriends]) => {
      setStats(loadedStats)
      setProfile(loadedProfile)
      setSocials(loadedProfile.socials.map((item) => `${item.name} | ${item.url}`).join('\n'))
      setTags(loadedProfile.tags.join(', '))
      setAvatarMessages(loadedProfile.avatarMessages.join('\n'))
      setSettings(loadedSettings)
      setFriends(loadedFriends)
    }).catch((error: unknown) => setMessage(error instanceof Error ? error.message : '無法載入後台資料。'))
  }, [authenticated])

  useEffect(() => {
    if (!authenticated || section !== 'overview') return
    fetchArticles().then(setArticles).catch(() => undefined)
    fetchAdminActivity().then(setActivity).catch(() => setActivity([]))
  }, [authenticated, section])

  useEffect(() => {
    if (!authenticated || section !== 'traffic') return
    let active = true
    queueMicrotask(() => { if (active) setAnalyticsLoading(true) })
    fetchAnalyticsStats(analyticsDays)
      .then((result) => { if (active) setAnalytics(result) })
      .catch((error: unknown) => { if (active) setMessage(error instanceof Error ? error.message : '無法載入流量資料。') })
      .finally(() => { if (active) setAnalyticsLoading(false) })
    return () => { active = false }
  }, [authenticated, section, analyticsDays, analyticsRefresh])

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage('')
    try {
      if (challengeMode) {
        const result = await attemptSqlLoginChallenge(username, password)
        setChallengeFlag(result.flag)
        setUsername('')
        setPassword('')
      } else {
        await loginAdmin(username, password)
        setAuthenticated(true)
        window.location.assign(getAdminPath())
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : challengeMode ? '挑戰驗證失敗。' : '登入失敗。')
    } finally { setBusy(false) }
  }

  function switchLoginMode(nextMode: boolean) {
    setChallengeMode(nextMode)
    setChallengeFlag('')
    setUsername('')
    setPassword('')
    setMessage('')
  }

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage('')
    const form = new FormData()
    form.set('name', profile.name); form.set('introduction', profile.introduction); form.set('quote', profile.quote)
    form.set('socials', JSON.stringify(socials.split('\n').map((line) => { const [name = '', ...url] = line.split('|'); return { name: name.trim(), url: url.join('|').trim() } }).filter((item) => item.name && item.url)))
    form.set('tags', JSON.stringify(tags.split(',').map((tag) => tag.trim()).filter(Boolean)))
    form.set('avatarMessages', JSON.stringify(avatarMessages.split('\n').map((item) => item.trim()).filter(Boolean)))
    form.set('updateTitle', profile.updateTitle); form.set('updateText', profile.updateText)
    if (avatar) form.set('avatar', avatar)
    try { const result = await updateHomeProfile(form); setProfile(result); setAvatar(null); setMessage('首頁內容已儲存。') }
    catch (error) { setMessage(error instanceof Error ? error.message : '儲存失敗。') }
    finally { setBusy(false) }
  }

  async function saveSite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage('')
    const form = new FormData(); form.set('siteName', settings.siteName); form.set('biography', settings.biography); form.set('experience', settings.experience)
    form.set('backgroundPositionX', String(settings.backgroundPositionX ?? 50))
    form.set('backgroundPositionY', String(settings.backgroundPositionY ?? 50))
    form.set('backgroundDesktopPositionX', String(settings.backgroundDesktopPositionX ?? settings.backgroundPositionX ?? 50))
    form.set('backgroundDesktopPositionY', String(settings.backgroundDesktopPositionY ?? settings.backgroundPositionY ?? 50))
    form.set('backgroundMobilePositionX', String(settings.backgroundMobilePositionX ?? settings.backgroundPositionX ?? 50))
    form.set('backgroundMobilePositionY', String(settings.backgroundMobilePositionY ?? settings.backgroundPositionY ?? 50))
    if (background) form.set('background', background)
    try {
      const saved = await updateSiteSettings(form)
      setSettings(saved); setBackground(null)
      applySiteBackground(saved)
      setMessage('網站設定已儲存。')
    }
    catch (error) { setMessage(error instanceof Error ? error.message : '儲存失敗。') }
    finally { setBusy(false) }
  }

  function startFriendEdit(friend?: Friend) {
    setEditingFriend(friend ?? null); setFriendName(friend?.name ?? ''); setFriendIntroduction(friend?.introduction ?? ''); setFriendUrl(friend?.url ?? ''); setFriendAvatar(null); setFriendModalOpen(true); setMessage('')
  }

  function closeFriendModal() {
    if (busy) return
    setFriendModalOpen(false); setEditingFriend(null); setFriendName(''); setFriendIntroduction(''); setFriendUrl(''); setFriendAvatar(null)
  }

  useEscapeKey(friendModalOpen && section === 'friends', closeFriendModal, 10)
  useEscapeKey(backgroundAdjustOpen && section === 'site', () => setBackgroundAdjustOpen(false), 20)

  async function saveFriend(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage('')
    const form = new FormData(); form.set('name', friendName); form.set('introduction', friendIntroduction); form.set('url', friendUrl)
    if (friendAvatar) form.set('avatar', friendAvatar)
    try {
      const saved = editingFriend ? await updateFriend(editingFriend.id, form) : await createFriend(form)
      setFriends((current) => editingFriend ? current.map((item) => item.id === saved.id ? saved : item) : [...current, saved])
      setFriendModalOpen(false); setEditingFriend(null); setFriendName(''); setFriendIntroduction(''); setFriendUrl(''); setFriendAvatar(null)
      setMessage(editingFriend ? '朋友資料已更新。' : '朋友已新增。')
    } catch (error) { setMessage(error instanceof Error ? error.message : '儲存失敗。') }
    finally { setBusy(false) }
  }

  async function removeFriend(friend: Friend) {
    setBusy(true); setMessage('')
    try { await deleteFriend(friend.id); setFriends((current) => current.filter((item) => item.id !== friend.id)); setFriendToDelete(null); setMessage(`已刪除「${friend.name}」。`) }
    catch (error) { setMessage(error instanceof Error ? error.message : '刪除失敗。') }
    finally { setBusy(false) }
  }

  function startBackgroundDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (!backgroundAdjustOpen || (event.pointerType === 'mouse' && event.button !== 0)) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    const image = previewImageRef.current
    const frame = previewFrameRef.current
    if (!image || !frame || !image.naturalWidth || !image.naturalHeight) return
    const coverScale = Math.max(frame.clientWidth / image.naturalWidth, frame.clientHeight / image.naturalHeight)
    pointerStartRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      positionX: backgroundViewport === 'desktop'
        ? settings.backgroundDesktopPositionX ?? settings.backgroundPositionX ?? 50
        : settings.backgroundMobilePositionX ?? settings.backgroundPositionX ?? 50,
      positionY: backgroundViewport === 'desktop'
        ? settings.backgroundDesktopPositionY ?? settings.backgroundPositionY ?? 50
        : settings.backgroundMobilePositionY ?? settings.backgroundPositionY ?? 50,
      overflowX: Math.max(1, image.naturalWidth * coverScale - frame.clientWidth),
      overflowY: Math.max(1, image.naturalHeight * coverScale - frame.clientHeight),
      active: true,
    }
    setBackgroundDragging(true)
  }

  function moveBackgroundDrag(event: React.PointerEvent<HTMLDivElement>) {
    const start = pointerStartRef.current
    if (!start || start.pointerId !== event.pointerId) return
    if (!start.active) {
      if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8) {
        if (holdTimerRef.current) clearTimeout(holdTimerRef.current)
        holdTimerRef.current = null
        pointerStartRef.current = null
      }
      return
    }
    const image = previewImageRef.current
    if (!image) return
    event.preventDefault()
    const positionX = Math.max(0, Math.min(100, start.positionX - ((event.clientX - start.x) / start.overflowX) * 100))
    const positionY = Math.max(0, Math.min(100, start.positionY - ((event.clientY - start.y) / start.overflowY) * 100))
    start.x = event.clientX
    start.y = event.clientY
    start.positionX = positionX
    start.positionY = positionY
    image.style.objectPosition = `${positionX}% ${positionY}%`
    if (backgroundPositionLabelRef.current) backgroundPositionLabelRef.current.textContent = `${backgroundViewport === 'desktop' ? '電腦' : '手機'}位置 ${Math.round(positionX)}% / ${Math.round(positionY)}%`
  }

  function stopBackgroundDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current)
    holdTimerRef.current = null
    const start = pointerStartRef.current
    if (start?.pointerId === event.pointerId && start.active) {
      setSettings((current) => backgroundViewport === 'desktop'
        ? { ...current, backgroundDesktopPositionX: start.positionX, backgroundDesktopPositionY: start.positionY }
        : { ...current, backgroundMobilePositionX: start.positionX, backgroundMobilePositionY: start.positionY })
    }
    pointerStartRef.current = null
    setBackgroundDragging(false)

    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  if (loading) return <main className="admin-loading">載入管理後台…</main>
  if (loginOnly && authenticated) return <main className="admin-loading">前往管理後台…</main>
  if (!authenticated && !loginOnly) return <main className="admin-loading">前往登入頁…</main>
  if (!authenticated) return <main className="admin-login-screen"><form className="admin-login-card" onSubmit={handleLogin}>
    <a className="admin-brand" href={getPublicPath('home')}><span className="admin-brand-main">BAIHU</span><span className="admin-brand-sub">STUDIO</span></a>
    <p>{challengeMode ? 'SQL 登入安全挑戰' : '登入以管理網站內容'}</p>
    {challengeAvailable && <button className="admin-login-mode-toggle" type="button" onClick={() => switchLoginMode(!challengeMode)}>{challengeMode ? '返回管理員登入' : '進入 SQL 安全挑戰'}</button>}
    {challengeFlag ? <div className="admin-login-flag" role="status"><span>FLAG CAPTURED</span><code>{challengeFlag}</code></div> : <>
      {challengeMode && <p className="admin-login-challenge-hint">使用挑戰帳號欄位完成驗證。挑戰不會登入管理後台。</p>}
      <label>帳號<input autoComplete={challengeMode ? 'off' : 'username'} maxLength={challengeMode ? 256 : undefined} value={username} onChange={(event) => setUsername(event.target.value)} required /></label>
      <label>密碼<input type="password" autoComplete={challengeMode ? 'new-password' : 'current-password'} maxLength={challengeMode ? 256 : undefined} value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
      {message && <p className="admin-feedback error" role="alert">{message}</p>}
      <button className="ui-button ui-button-primary" disabled={busy}>{busy ? challengeMode ? '驗證中…' : '登入中…' : challengeMode ? '提交挑戰' : '登入後台'}</button>
    </>}
  </form></main>

  const nav: { id: Exclude<Section, 'login'>; label: string; mobileLabel: string; icon: string }[] = [
    { id: 'overview', label: '總覽', mobileLabel: '總覽', icon: '⌂' },
    { id: 'home', label: '首頁內容', mobileLabel: '首頁', icon: '◎' },
    { id: 'projects', label: 'Projects', mobileLabel: '作品', icon: '▦' },
    { id: 'friends', label: 'Friends', mobileLabel: '友站', icon: '♧' },
    { id: 'music', label: '音樂管理', mobileLabel: '音樂', icon: '♫' },
    { id: 'traffic', label: '流量分析', mobileLabel: '流量', icon: '◔' },
    { id: 'site', label: '網站設定', mobileLabel: '設定', icon: '⚙' },
  ]
  const title = section === 'home' ? '首頁內容' : section === 'site' ? '網站設定' : section === 'traffic' ? '流量分析' : section === 'friends' ? 'Friends 管理' : section === 'projects' ? 'Projects 管理' : section === 'music' ? '音樂管理' : '總覽'

  const maxDailyViews = Math.max(1, ...analytics.daily.map((item) => item.views))
  const deviceTotal = analytics.devices.mobile + analytics.devices.tablet + analytics.devices.desktop
  const mobileShare = deviceTotal ? Math.round((analytics.devices.mobile / deviceTotal) * 100) : 0
  const topPage = analytics.topPages[0]
  const topRegion = analytics.topRegions[0]
  const changePercent = analytics.previousViews ? Math.round(((analytics.totalViews - analytics.previousViews) / analytics.previousViews) * 100) : null
  const contentMonths = Array.from({ length: 6 }, (_unused, index) => {
    const date = new Date()
    date.setDate(1)
    date.setMonth(date.getMonth() - 5 + index)
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    const published = articles.filter((article) => article.publishedAt.slice(0, 7) === key).length
    const updated = articles.filter((article) => (article.updatedAt ?? article.publishedAt).slice(0, 7) === key).length
    return { label: date.toLocaleDateString('zh-TW', { month: 'short' }), published, updated: Math.max(0, updated - published) }
  })
  const maxContentMonth = Math.max(1, ...contentMonths.map((month) => month.published + month.updated))
  const categories = articles.reduce<Record<string, number>>((counts, article) => { counts[article.category || '未分類'] = (counts[article.category || '未分類'] ?? 0) + 1; return counts }, {})
  const topCategories = Object.entries(categories).sort((first, second) => second[1] - first[1]).slice(0, 5)
  const sourceTotal = Object.values(analytics.sources).reduce((total, views) => total + views, 0)
  const sourceLabels = [{ key: 'search', label: '搜尋引擎' }, { key: 'social', label: '社群平台' }, { key: 'referral', label: '外部連結' }, { key: 'direct', label: '直接進站' }] as const
  return <main className="admin-app">
    <aside className="admin-rail"><a className="admin-brand" href={getAdminPath()}><span className="admin-brand-main">BAIHU</span><span className="admin-brand-sub">STUDIO</span></a><nav>{nav.map((item) => <a key={item.id} className={section === item.id ? 'active' : ''} href={getAdminPath(item.id)}><i>{item.icon}</i>{item.label}</a>)}</nav><a className="admin-rail-site" href={getPublicPath('home')}>↗ 查看網站</a></aside>
    <div className="admin-main"><header className="admin-topbar"><div className="admin-topbar-title"><strong>網站管理</strong><span aria-hidden="true">/</span><h1>{title}</h1></div><button className="admin-logout" onClick={() => logoutAdmin().then(() => { setAuthenticated(false); window.location.assign(getPublicPath('home')) }).catch((error: unknown) => setMessage(error instanceof Error ? error.message : '登出失敗。'))}>登出</button></header>
      <nav className="admin-mobile-nav">{nav.map((item) => <a key={item.id} className={section === item.id ? 'active' : ''} href={getAdminPath(item.id)}><i>{item.icon}</i><span className="admin-nav-label-desktop">{item.label}</span><span className="admin-nav-label-mobile">{item.mobileLabel}</span></a>)}</nav>
      <div className="admin-content">
        {message && <p className="admin-feedback">{message}</p>}
        {section === 'overview' && <div className="admin-overview-page">
          <section className="admin-welcome admin-mobile-home-link"><div><p className="admin-kicker">CONTENT DESK</p><h2>網站營運一覽</h2><p>管理首頁資訊與網站外觀；文章集中在 Blog 維護。</p></div><a className="ui-button ui-button-primary" href={getPublicPath('home')}>回到主頁 <span>↗</span></a></section>
          <div className="admin-metrics"><article><span>已發布文章</span><strong>{stats.articleCount}</strong><a href={getPublicPath('blog')}>在 Blog 管理 ↗</a></article><article><span>分類</span><strong>{stats.categoryCount}</strong><small>文章整理狀況</small></article><article><span>標籤</span><strong>{stats.tagCount}</strong><small>文章主題索引</small></article><article><span>文章總字數</span><strong>{stats.totalWords.toLocaleString()}</strong><small>已發布內容累積</small></article><article><span>網站運作</span><strong>{stats.runtimeDays.toLocaleString()}<em> 天</em></strong><small>持續更新中</small></article><article><span>最後更新</span><strong className="metric-date">{stats.lastActivity ? new Date(stats.lastActivity).toLocaleDateString() : '尚無紀錄'}</strong><small>最近發布文章</small></article></div>

          <div className="admin-overview-grid">
            <section className="admin-overview-card admin-content-trends"><div className="admin-overview-card-heading"><div><p className="admin-kicker">CONTENT RHYTHM</p><h2>內容更新趨勢</h2></div><a href={getPublicPath('blog')}>文章管理 ↗</a></div><p className="admin-overview-description">最近六個月的文章發布與更新紀錄。</p><div className="admin-month-chart">{contentMonths.map((month) => { const total = month.published + month.updated; return <div className="admin-month-column" key={month.label} title={`${month.label}：發布 ${month.published} 篇，更新 ${month.updated} 篇`}><strong>{total || ''}</strong><div className="admin-month-bar"><i style={{ height: `${(month.published / maxContentMonth) * 100}%` }} /><b style={{ height: `${(month.updated / maxContentMonth) * 100}%` }} /></div><small>{month.label}</small></div> })}</div><div className="admin-chart-legend"><span><i />發布</span><span><i />更新</span></div><div className="admin-category-list"><h3>文章分類</h3>{topCategories.length ? topCategories.map(([name, count]) => <div key={name}><span>{name}</span><i><b style={{ width: `${Math.max(5, count / Math.max(1, stats.articleCount) * 100)}%` }} /></i><strong>{count}</strong></div>) : <p>目前還沒有文章分類。</p>}</div></section>

          </div>
          <section className="admin-overview-card admin-activity-card"><div className="admin-overview-card-heading"><div><p className="admin-kicker">RECENT CHANGES</p><h2>近期活動</h2></div><span>最近 50 筆</span></div>{activity.length ? <div className="admin-activity-list">{activity.slice(0, 6).map((item, index) => <div key={`${item.at}-${index}`}><i className={`activity-mark ${item.type}`} /><span><strong>{item.title}</strong><small>{item.type === 'article' ? item.action === 'published' ? '發布文章' : item.action === 'updated' ? '更新文章' : '刪除文章' : item.type === 'homepage' ? '儲存首頁內容' : '儲存網站設定'}</small></span><time>{new Date(item.at).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</time></div>)}</div> : <p className="admin-activity-empty">儲存首頁或網站設定、發布文章後，活動紀錄會顯示在這裡。</p>}</section>
        </div>}
        {section === 'traffic' && <section className="admin-traffic-page">
          <div className="admin-traffic-heading"><div><p className="admin-kicker">SITE ANALYTICS</p><h2>流量分析</h2><p>IP 僅用於判斷訪客國家與區域；原始 IP、訪客識別碼與精確座標都不會保存。</p><span className="admin-traffic-tracking"><i aria-hidden="true" />地區彙總已啟用</span></div><button className="admin-refresh-button" onClick={() => setAnalyticsRefresh((value) => value + 1)} disabled={analyticsLoading}>{analyticsLoading ? '更新中…' : '↻ 更新資料'}</button></div>
          <div className="admin-traffic-toolbar"><span>統計期間</span><div className="admin-period-switch" aria-label="選擇統計期間">{([7, 30] as const).map((days) => <button key={days} className={analyticsDays === days ? 'active' : ''} onClick={() => setAnalyticsDays(days)}>{days} 天</button>)}</div><small>每日 UTC 統計</small></div>
          <div className="admin-traffic-kpis"><article><span>總瀏覽量</span><strong>{analytics.totalViews.toLocaleString()}</strong><small>{changePercent === null ? '前期尚無資料' : `${changePercent > 0 ? '+' : ''}${changePercent}% 對比前 ${analyticsDays} 天`}</small></article><article><span>已辨識地區</span><strong>{analytics.regionCount.toLocaleString()}</strong><small>{topRegion ? `最多瀏覽：${topRegion.country} ${topRegion.region}` : '僅計有地區資料的彙總'}</small></article><article><span>每日平均</span><strong>{Math.round(analytics.totalViews / analyticsDays).toLocaleString()}</strong><small>此期間每日頁面瀏覽</small></article><article><span>主要瀏覽頁面</span><strong className="traffic-kpi-text">{topPage?.label ?? '尚無資料'}</strong><small>{topPage ? `${topPage.views.toLocaleString()} 次瀏覽` : '資料累積後顯示'}</small></article><article><span>手機裝置占比</span><strong>{mobileShare}%</strong><small>{deviceTotal.toLocaleString()} 次裝置統計</small></article></div>
          <div className="admin-traffic-grid"><section className="admin-traffic-card admin-traffic-chart-card"><div className="admin-traffic-card-heading"><div><h3>瀏覽趨勢</h3><p>每日頁面瀏覽次數</p></div><strong>{analytics.totalViews.toLocaleString()} <small>次</small></strong></div>{analytics.totalViews === 0 ? <div className="admin-chart-empty"><span>—</span><p>目前還沒有流量資料</p><small>新訪客開始瀏覽網站後，統計會從今天累積。</small></div> : <div className="admin-traffic-chart" role="img" aria-label={`${analytics.days} 天每日瀏覽趨勢`}>{analytics.daily.map((item, index) => <div className="admin-chart-column" key={item.day} title={`${item.day}：${item.views} 次`}><span className="admin-chart-value">{item.views || ''}</span><i style={{ height: `${Math.max(item.views ? 7 : 2, (item.views / maxDailyViews) * 100)}%` }} /><small>{analytics.days === 7 || index % 5 === 0 || index === analytics.daily.length - 1 ? new Date(`${item.day}T00:00:00Z`).toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric', timeZone: 'UTC' }) : ''}</small></div>)}</div>}</section>
            <section className="admin-traffic-card"><div className="admin-traffic-card-heading"><div><h3>裝置分布</h3><p>依瀏覽器提供的裝置類型分類</p></div></div><div className="admin-device-list">{([{ key: 'desktop', label: '桌面裝置' }, { key: 'mobile', label: '手機' }, { key: 'tablet', label: '平板' }] as const).map(({ key, label }) => { const count = analytics.devices[key]; const percent = deviceTotal ? Math.round(count / deviceTotal * 100) : 0; return <div className="admin-device-row" key={key}><div><span>{label}</span><strong>{count.toLocaleString()} <small>{percent}%</small></strong></div><div className="admin-device-track"><i style={{ width: `${percent}%` }} /></div></div> })}</div></section></div>
          <section className="admin-traffic-card admin-source-card"><div className="admin-traffic-card-heading"><div><h3>進站來源</h3><p>每個瀏覽工作階段只計一次入口來源；只保存分類，不保存來源網址。</p></div><strong>{sourceTotal.toLocaleString()} <small>次進站</small></strong></div><div className="admin-source-grid">{sourceLabels.map(({ key, label }) => { const count = analytics.sources[key]; const percent = sourceTotal ? Math.round(count / sourceTotal * 100) : 0; return <div key={key}><span>{label}</span><strong>{count.toLocaleString()} <small>{percent}%</small></strong><i><b style={{ width: `${percent}%` }} /></i></div> })}</div></section>
          <section className="admin-traffic-card admin-region-card"><div className="admin-traffic-card-heading"><div><h3>訪問地區</h3><p>依國家與區域彙總瀏覽次數，不保存 IP 或個人識別資料。</p></div></div>{analytics.topRegions.length ? <div className="admin-region-list">{analytics.topRegions.map((item) => { const percent = Math.round(item.views / analytics.topRegions[0].views * 100); return <div className="admin-region-row" key={`${item.country}-${item.region}`}><span><strong>{item.country}</strong><small>{item.region}</small></span><i><b style={{ width: `${percent}%` }} /></i><strong className="admin-region-count">{item.views.toLocaleString()} <small>次</small></strong></div> })}</div> : <p className="admin-traffic-no-pages">尚無地區資料。請確認可信任的反向代理有提供國家與區域 GeoIP 標頭。</p>}</section>
          <section className="admin-traffic-card admin-top-pages"><div className="admin-traffic-card-heading"><div><h3>文章成效</h3><p>訪客開啟文章後記錄，依瀏覽次數排序。</p></div></div>{analytics.topArticles.length ? <div className="admin-top-pages-list">{analytics.topArticles.map((item, index) => <div key={item.id}><span className="traffic-rank">{String(index + 1).padStart(2, '0')}</span><strong>{item.title}</strong><div className="admin-page-views-track"><i style={{ width: `${Math.max(4, item.views / analytics.topArticles[0].views * 100)}%` }} /></div><span>{item.views.toLocaleString()} <small>次</small></span></div>)}</div> : <p className="admin-traffic-no-pages">文章開啟後會開始累積成效資料。</p>}</section>
          <section className="admin-traffic-card admin-top-pages"><div className="admin-traffic-card-heading"><div><h3>熱門頁面</h3><p>依頁面瀏覽次數排序</p></div></div>{analytics.topPages.length ? <div className="admin-top-pages-list">{analytics.topPages.map((item, index) => <div key={item.page}><span className="traffic-rank">{String(index + 1).padStart(2, '0')}</span><strong>{item.label}</strong><div className="admin-page-views-track"><i style={{ width: `${Math.max(4, item.views / (topPage?.views || 1) * 100)}%` }} /></div><span>{item.views.toLocaleString()} <small>次</small></span></div>)}</div> : <p className="admin-traffic-no-pages">流量資料累積後，這裡會列出訪客最常瀏覽的頁面。</p>}</section>
          <p className="admin-analytics-note">地區統計只保存每日國家／區域瀏覽總數，最多 120 天；不保存原始 IP、IP 雜湊、訪客識別碼、城市、精確位置或座標。需由已設定的 TRUSTED_PROXY_IP 反向代理提供 CF-IPCountry／CF-Region 或 X-Geo-Country／X-Geo-Region 標頭。</p>
        </section>}
        {section === 'home' && <form className="admin-form-card" onSubmit={saveProfile}><div className="admin-form-intro"><div><h2>首頁個人介紹</h2><p>這些內容會顯示在網站首頁。</p></div><button className="ui-button ui-button-primary" disabled={busy}>{busy ? '儲存中…' : '儲存變更'}</button></div>
          <div className="admin-form-grid"><div className="admin-form-section span-two"><span>個人介紹</span></div><div className="admin-field span-two">頭像<FileDropzone title="上傳首頁頭像" file={avatar} previewUrl={profile.avatarUrl} onFile={setAvatar} /></div>
            <label className="admin-field span-two avatar-messages-field">點擊頭像時顯示的文字 <small>每行一則，點擊頭像時隨機顯示一則</small><textarea rows={8} maxLength={3200} value={avatarMessages} onChange={(event) => setAvatarMessages(event.target.value)} placeholder={'嗨，歡迎來逛逛！ (｡•̀ᴗ-)✧\n今天也要保持好奇心！ (ง •̀_•́)ง'} /></label>
            <label className="admin-field">顯示名稱<input value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} /></label><label className="admin-field">首頁短句<input value={profile.quote} onChange={(event) => setProfile({ ...profile, quote: event.target.value })} /></label>
            <label className="admin-field span-two">個人介紹<textarea rows={4} value={profile.introduction} onChange={(event) => setProfile({ ...profile, introduction: event.target.value })} /></label><label className="admin-field span-two">社群連結 <small>每行一筆：名稱 | 網址</small><textarea rows={3} value={socials} onChange={(event) => setSocials(event.target.value)} placeholder={'Instagram | https://…\nGitHub | https://…'} /></label>
            <label className="admin-field span-two">個人標籤 <small>以逗號分隔</small><input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="設計, 開發, 日常" /></label><div className="admin-form-section span-two"><span>首頁動態</span></div><label className="admin-field span-two">區塊標題<input value={profile.updateTitle} onChange={(event) => setProfile({ ...profile, updateTitle: event.target.value })} /></label><label className="admin-field span-two">動態內容<textarea rows={3} value={profile.updateText} onChange={(event) => setProfile({ ...profile, updateText: event.target.value })} /></label>
          </div>
        </form>}
        {section === 'friends' && <section className="admin-friends-manager">
          <div className="admin-friends-heading"><div><p className="admin-kicker">FRIENDS DIRECTORY</p><h2>朋友連結</h2><p>管理公開 Friends 頁面上的人物卡片。</p></div><div className="admin-friends-actions"><a className="ui-button ui-button-primary" href={getPublicPath('friends')} target="_blank" rel="noreferrer">預覽頁面 ↗</a><button type="button" className="ui-button ui-button-primary" onClick={() => startFriendEdit()}>＋ 新增朋友</button></div></div>
          <div className="admin-friend-list">{friends.length ? friends.map((friend) => <article key={friend.id}>{friend.avatarUrl ? <img src={friend.avatarUrl} alt="" /> : <span className="admin-friend-avatar-fallback">{friend.name.slice(0, 1)}</span>}<div><strong>{friend.name}</strong><p>{friend.introduction || '尚未填寫自介'}</p><a href={friend.url} target="_blank" rel="noreferrer">{friend.url}</a></div><div className="admin-friend-actions"><button type="button" className="ui-button ui-button-secondary ui-button-small" onClick={() => startFriendEdit(friend)}>編輯</button><button type="button" className="ui-button ui-button-danger ui-button-small" disabled={busy} onClick={() => setFriendToDelete(friend)}>刪除</button></div></article>) : <p className="admin-friend-empty">尚未新增朋友，建立第一張卡片吧。</p>}</div>
          {friendModalOpen && <div className="friend-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeFriendModal() }}><section className="friend-modal" role="dialog" aria-modal="true" aria-labelledby="friend-modal-title"><header className="friend-modal-heading"><div><p className="admin-kicker">FRIENDS DIRECTORY</p><h2 id="friend-modal-title">{editingFriend ? '編輯朋友' : '新增朋友'}</h2></div><button type="button" className="friend-modal-close" aria-label="關閉" onClick={closeFriendModal}>×</button></header>
            <form className="admin-friend-form" onSubmit={saveFriend}><div className="admin-form-grid"><div className="admin-field span-two">頭像 <FileDropzone title="上傳朋友頭像" file={friendAvatar} previewUrl={editingFriend?.avatarUrl} onFile={setFriendAvatar} /></div>
              <label className="admin-field">名稱<input required maxLength={120} value={friendName} onChange={(event) => setFriendName(event.target.value)} placeholder="朋友名稱" /></label>
              <label className="admin-field">網站連結<input required type="url" value={friendUrl} onChange={(event) => setFriendUrl(event.target.value)} placeholder="https://example.com" /></label>
              <label className="admin-field span-two">自我介紹 <small>最多 1000 字</small><textarea rows={3} maxLength={1000} value={friendIntroduction} onChange={(event) => setFriendIntroduction(event.target.value)} placeholder="簡單介紹一下這位朋友…" /></label>
            </div><div className="friend-modal-footer"><button type="button" className="ui-button ui-button-secondary" disabled={busy} onClick={closeFriendModal}>取消</button><button className="ui-button ui-button-primary" disabled={busy}>{busy ? '儲存中…' : editingFriend ? '儲存編輯' : '新增朋友'}</button></div></form>
          </section></div>}
        </section>}
        {section === 'projects' && <ProjectsPage embedded />}
        {section === 'music' && <MusicManager onMessage={handleMusicMessage} />}
        {section === 'site' && <form className="admin-form-card admin-site-settings-form" onSubmit={saveSite}><div className="admin-form-intro"><div><h2>網站設定</h2></div><button className="ui-button ui-button-primary" disabled={busy}>{busy ? '儲存中…' : '儲存'}</button></div><div className="admin-form-grid">
          <label className="admin-field span-two">網站名稱<input value={settings.siteName} onChange={(event) => setSettings({ ...settings, siteName: event.target.value })} /></label><label className="admin-field span-two">About 自介（Markdown） <small>支援標題、清單、粗體與連結</small><textarea rows={8} value={settings.biography} onChange={(event) => setSettings({ ...settings, biography: event.target.value })} placeholder={'## 關於我\n\n在這裡寫下你的故事…'} /></label><label className="admin-field span-two">經歷<textarea rows={5} value={settings.experience} onChange={(event) => setSettings({ ...settings, experience: event.target.value })} /></label>
          <div className="admin-form-section span-two"><span>首頁背景</span></div><div className="admin-field span-two"><span>背景圖片</span><FileDropzone title="選擇或拖入圖片" file={background} previewUrl={settings.backgroundUrl} onFile={setBackground} />
            {(backgroundPreview || settings.backgroundUrl) && <button type="button" className="background-open-editor" onClick={() => { setBackgroundViewport('desktop'); setBackgroundAdjustOpen(true) }}>開啟背景編輯器 <span>電腦／手機分別調整</span></button>}
            {backgroundAdjustOpen && (backgroundPreview || settings.backgroundUrl) && <div className="image-adjust-backdrop background-adjust-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setBackgroundAdjustOpen(false) }}>
              <section className={`image-adjust-modal background-adjust-modal ${backgroundViewport === 'mobile' ? 'is-mobile' : 'is-desktop'}`} role="dialog" aria-modal="true" aria-labelledby="background-adjust-title">
                <header><div><strong id="background-adjust-title">調整首頁背景</strong><small>拖曳圖片定位 · 電腦與手機會分別保存位置</small></div><button type="button" aria-label="關閉背景編輯器" onClick={() => setBackgroundAdjustOpen(false)}>×</button></header>
                <div className="background-modal-toolbar" role="tablist" aria-label="選擇背景預覽裝置"><span>預覽裝置</span><div><button type="button" className={backgroundViewport === 'desktop' ? 'active' : ''} onClick={() => setBackgroundViewport('desktop')}>電腦</button><button type="button" className={backgroundViewport === 'mobile' ? 'active' : ''} onClick={() => setBackgroundViewport('mobile')}>手機</button></div></div>
                <div className={`image-adjust-viewport background-adjust-viewport ${backgroundViewport === 'mobile' ? 'is-mobile' : 'is-desktop'}${backgroundDragging ? ' is-dragging' : ''}`} ref={previewFrameRef} onPointerDown={startBackgroundDrag} onPointerMove={moveBackgroundDrag} onPointerUp={stopBackgroundDrag} onPointerCancel={stopBackgroundDrag} onLostPointerCapture={stopBackgroundDrag}>
                  <img ref={previewImageRef} src={backgroundPreview || settings.backgroundUrl} alt={`${backgroundViewport === 'mobile' ? '手機' : '電腦'}首頁背景預覽`} draggable={false} style={{ objectPosition: `${(backgroundViewport === 'desktop' ? settings.backgroundDesktopPositionX ?? settings.backgroundPositionX : settings.backgroundMobilePositionX ?? settings.backgroundPositionX) ?? 50}% ${(backgroundViewport === 'desktop' ? settings.backgroundDesktopPositionY ?? settings.backgroundPositionY : settings.backgroundMobilePositionY ?? settings.backgroundPositionY) ?? 50}%` }} />
                  <span className="background-modal-hint">{backgroundDragging ? '正在調整位置' : '左鍵拖曳 · 手機長按後拖曳'}</span>
                </div>
                <footer><span ref={backgroundPositionLabelRef}>{backgroundViewport === 'desktop' ? '電腦' : '手機'}位置 {Math.round((backgroundViewport === 'desktop' ? settings.backgroundDesktopPositionX ?? settings.backgroundPositionX : settings.backgroundMobilePositionX ?? settings.backgroundPositionX) ?? 50)}% / {Math.round((backgroundViewport === 'desktop' ? settings.backgroundDesktopPositionY ?? settings.backgroundPositionY : settings.backgroundMobilePositionY ?? settings.backgroundPositionY) ?? 50)}%</span><button type="button" className="ui-button ui-button-primary ui-button-small" onClick={() => setBackgroundAdjustOpen(false)}>完成調整</button></footer>
              </section>
            </div>}
          </div>
        </div></form>}
      </div>
    </div>
    <ConfirmDialog
      open={Boolean(friendToDelete)}
      title="刪除這位朋友？"
      message={friendToDelete ? `「${friendToDelete.name}」刪除後將無法復原。` : ''}
      busy={busy}
      onConfirm={() => friendToDelete ? removeFriend(friendToDelete) : undefined}
      onCancel={() => { if (!busy) setFriendToDelete(null) }}
    />
  </main>
}

export default AdminPage
