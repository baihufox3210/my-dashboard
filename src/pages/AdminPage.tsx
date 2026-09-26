import { useEffect, useRef, useState } from 'react'
import {
  fetchAdminSession,
  fetchArticles,
  fetchArticleStats,
  loginAdmin,
  logoutAdmin,
  publishArticle,
  updateArticle,
  fetchHomeProfile,
  updateHomeProfile,
} from '../features/blog/api'
import MarkdownPreview from '../components/MarkdownPreview'
import type { Article, ArticleStats, HomeProfile } from '../features/blog/article'

type AdminRoute = { view: 'dashboard' | 'login' | 'new' | 'edit'; id?: string; returnTo?: string }

function getAdminRoute(): AdminRoute {
  const [, action, ...parts] = window.location.hash.slice(1).split('/')
  if (action === 'login') return { view: 'login', returnTo: decodeURIComponent(parts.join('/') || 'admin') }
  if (action === 'new') return { view: 'new' }
  if (action === 'edit' && parts[0]) return { view: 'edit', id: decodeURIComponent(parts[0]) }
  return { view: 'dashboard' }
}

const emptyStats: ArticleStats = {
  articleCount: 0,
  categoryCount: 0,
  tagCount: 0,
  totalWords: 0,
  runtimeDays: 0,
  lastActivity: null,
}

const defaultHomeProfile: HomeProfile = { name: 'baihu', introduction: '', quote: '', socials: [], tags: [], updateTitle: '', updateText: '' }

async function cropCoverImage(file: File, position: { x: number; y: number }) {
  const imageUrl = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = imageUrl
    await image.decode()
    const aspect = 16 / 9
    const sourceWidth = image.naturalWidth
    const sourceHeight = image.naturalHeight
    let cropWidth = sourceWidth
    let cropHeight = sourceHeight
    let sourceX = 0
    let sourceY = 0
    if (sourceWidth / sourceHeight > aspect) {
      cropWidth = sourceHeight * aspect
      sourceX = (sourceWidth - cropWidth) * position.x / 100
    } else {
      cropHeight = sourceWidth / aspect
      sourceY = (sourceHeight - cropHeight) * position.y / 100
    }
    const canvas = document.createElement('canvas')
    canvas.width = 1600
    canvas.height = 900
    const context = canvas.getContext('2d')
    if (!context) return file
    context.drawImage(image, sourceX, sourceY, cropWidth, cropHeight, 0, 0, canvas.width, canvas.height)
    const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.92))
    if (!blob) return file
    const extension = type === 'image/png' ? 'png' : 'jpg'
    return new File([blob], `cover-image.${extension}`, { type })
  } finally {
    URL.revokeObjectURL(imageUrl)
  }
}

function AdminPage() {
  const [route, setRoute] = useState(getAdminRoute)
  const [authenticated, setAuthenticated] = useState(false)
  const [articles, setArticles] = useState<Article[]>([])
  const [stats, setStats] = useState<ArticleStats>(emptyStats)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('')
  const [tags, setTags] = useState('')
  const [content, setContent] = useState('')
  const [coverImage, setCoverImage] = useState<File | null>(null)
  const [coverPreviewUrl, setCoverPreviewUrl] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [moveImage, setMoveImage] = useState(false)
  const [draggingImage, setDraggingImage] = useState(false)
  const [imagePosition, setImagePosition] = useState({ x: 50, y: 50 })
  const imageFrameRef = useRef<HTMLDivElement>(null)
  const previewImageRef = useRef<HTMLImageElement>(null)
  const dragStartRef = useRef<{ x: number; y: number; positionX: number; positionY: number } | null>(null)

  useEffect(() => {
    if (!coverImage) {
      setCoverPreviewUrl('')
      return
    }
    const imageUrl = URL.createObjectURL(coverImage)
    setCoverPreviewUrl(imageUrl)
    return () => URL.revokeObjectURL(imageUrl)
  }, [coverImage])
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [homeProfile, setHomeProfile] = useState<HomeProfile>(defaultHomeProfile)
  const [profileAvatar, setProfileAvatar] = useState<File | null>(null)
  const [profileMessage, setProfileMessage] = useState('')
  const [socialLines, setSocialLines] = useState('')
  const [tagText, setTagText] = useState('')

  useEffect(() => {
    const onHashChange = () => {
      setRoute(getAdminRoute())
      setMessage('')
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  useEffect(() => {
    fetchAdminSession()
      .then(({ authenticated: loggedIn }) => setAuthenticated(loggedIn))
      .catch(() => setAuthenticated(false))
  }, [])

  useEffect(() => {
    if (!authenticated) return
    Promise.all([fetchArticles(), fetchArticleStats()])
      .then(([loadedArticles, loadedStats]) => {
        setArticles(loadedArticles)
        setStats(loadedStats)
      })
      .catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'Could not load admin data.'))
  }, [authenticated])

  useEffect(() => {
    if (!authenticated) return
    fetchHomeProfile().then((profile) => {
      setHomeProfile(profile)
      setSocialLines(profile.socials.map((item) => `${item.name} | ${item.url}`).join('\n'))
      setTagText(profile.tags.join(', '))
    }).catch((error: unknown) => setProfileMessage(error instanceof Error ? error.message : 'Could not load profile.'))
  }, [authenticated])

  async function handleProfileSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const socials = socialLines.split('\n').map((line) => {
      const [name = '', ...urlParts] = line.split('|')
      return { name: name.trim(), url: urlParts.join('|').trim() }
    }).filter((item) => item.name && item.url)
    const formData = new FormData()
    formData.set('name', homeProfile.name)
    formData.set('introduction', homeProfile.introduction)
    formData.set('quote', homeProfile.quote)
    formData.set('socials', JSON.stringify(socials))
    formData.set('tags', JSON.stringify(tagText.split(',').map((tag) => tag.trim()).filter(Boolean)))
    formData.set('updateTitle', homeProfile.updateTitle)
    formData.set('updateText', homeProfile.updateText)
    if (profileAvatar) formData.set('avatar', profileAvatar)
    setBusy(true)
    setProfileMessage('')
    try {
      const saved = await updateHomeProfile(formData)
      setHomeProfile(saved)
      setProfileAvatar(null)
      setSocialLines(saved.socials.map((item) => `${item.name} | ${item.url}`).join('\n'))
      setTagText(saved.tags.join(', '))
      setProfileMessage('個人首頁已更新。')
    } catch (error) {
      setProfileMessage(error instanceof Error ? error.message : 'Could not save profile.')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (!authenticated || (route.view !== 'edit' && route.view !== 'new')) return
    setMessage('')
    setCoverImage(null)
    setShowPreview(false)
    setMoveImage(false)
    setDraggingImage(false)
    setImagePosition({ x: 50, y: 50 })
    if (route.view === 'new') {
      setTitle('')
      setCategory('')
      setTags('')
      setContent('')
      return
    }
    const article = articles.find((item) => item.id === route.id)
    if (!article) {
      if (articles.length) setMessage('Article not found.')
      return
    }
    setTitle(article.title)
    setCategory(article.category)
    setTags(article.tags.join(', '))
    setContent(article.content)
  }, [authenticated, route, articles])

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    try {
      await loginAdmin(username, password)
      setAuthenticated(true)
      window.location.hash = `#${route.returnTo || 'admin'}`
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Login failed.')
    } finally {
      setBusy(false)
    }
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!title.trim() || !content.trim()) {
      setMessage('Title and content are required.')
      return
    }
    const formData = new FormData()
    formData.set('title', title)
    formData.set('category', category)
    formData.set('tags', tags)
    formData.set('content', content)
    setBusy(true)
    setMessage('')
    try {
      let imageToSave = coverImage
      const existingArticle = articles.find((article) => article.id === route.id)
      if (!imageToSave && existingArticle?.coverImage && (imagePosition.x !== 50 || imagePosition.y !== 50)) {
        const response = await fetch(existingArticle.coverImage)
        if (response.ok) {
          const blob = await response.blob()
          imageToSave = new File([blob], 'existing-cover', { type: blob.type || 'image/jpeg' })
        }
      }
      if (imageToSave) formData.set('coverImage', await cropCoverImage(imageToSave, imagePosition))
      if (route.view === 'edit' && route.id) await updateArticle(route.id, formData)
      else await publishArticle(formData)
      window.location.hash = '#admin'
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save article.')
    } finally {
      setBusy(false)
    }
  }

  function startImageDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (!moveImage || event.button !== 0 || (event.target as HTMLElement).closest('button') || !previewImageRef.current || !imageFrameRef.current) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragStartRef.current = { x: event.clientX, y: event.clientY, positionX: imagePosition.x, positionY: imagePosition.y }
    setDraggingImage(true)
  }

  function moveImageDrag(event: React.PointerEvent<HTMLDivElement>) {
    const start = dragStartRef.current
    const image = previewImageRef.current
    const frame = imageFrameRef.current
    if (!moveImage || !start || !image || !frame) return
    const scale = Math.max(frame.clientWidth / image.naturalWidth, frame.clientHeight / image.naturalHeight)
    const extraX = Math.max(1, image.naturalWidth * scale - frame.clientWidth)
    const extraY = Math.max(1, image.naturalHeight * scale - frame.clientHeight)
    setImagePosition({
      x: Math.max(0, Math.min(100, start.positionX - ((event.clientX - start.x) / extraX) * 100)),
      y: Math.max(0, Math.min(100, start.positionY - ((event.clientY - start.y) / extraY) * 100)),
    })
  }

  function stopImageDrag() {
    dragStartRef.current = null
    setDraggingImage(false)
  }

  if (route.view === 'login' || !authenticated) {
    return (
      <main className="main-page admin-page">
        <form className="admin-login" onSubmit={handleLogin}>
          <h1>Admin login</h1>
          <label className="field-label">Username<input autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required /></label>
          <label className="field-label">Password<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
          {message && <p className="error-message">{message}</p>}
          <button className="save-button" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        </form>
      </main>
    )
  }

  if (route.view === 'new' || route.view === 'edit') {
    return (
      <main className="main-page admin-page article-editor-page">
        <div className="editor-page-heading">
          <div>
            <p className="editor-eyebrow">CONTENT STUDIO</p>
            <h1>{route.view === 'new' ? 'Create an article' : 'Edit article'}</h1>
          </div>
          <a className="editor-back-link" href="#admin">← <span>All articles</span></a>
        </div>
        <form className="article-editor article-editor-layout" onSubmit={handleSave}>
          <div className="editor-workspace">
            <div className="editor-left-column">
              <label className="editor-field editor-title-card">
                <span>Title</span>
                <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Give your article a title" required />
              </label>
              <section className="editor-options-card editor-details-card">
                <h2>Details</h2>
                <label className="editor-field">Category<input value={category} onChange={(event) => setCategory(event.target.value)} placeholder="Uncategorized" /></label>
                <label className="editor-field">Tags<input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="Design, notes, ideas" /></label>
                <label className="editor-field">Cover image
                  <span className="editor-upload-control">
                    <input type="file" accept="image/*" onChange={(event) => { setCoverImage(event.target.files?.[0] ?? null); setImagePosition({ x: 50, y: 50 }) }} />
                    <span>{coverImage ? coverImage.name : 'Choose an image'}</span>
                  </span>
                </label>
                <p className="editor-upload-hint">Optional · JPG, PNG or WebP</p>
                {(coverImage || articles.find((article) => article.id === route.id)?.coverImage) && (
                  <div
                    className={`editor-cover-frame${moveImage ? ' is-movable' : ''}${draggingImage ? ' is-dragging' : ''}`}
                    ref={imageFrameRef}
                  onPointerDown={startImageDrag}
                  onPointerMove={moveImageDrag}
                  onPointerUp={stopImageDrag}
                  onPointerCancel={stopImageDrag}
                    onDragStart={(event) => event.preventDefault()}
                  >
                    <img
                      ref={previewImageRef}
                      src={coverPreviewUrl || articles.find((article) => article.id === route.id)?.coverImage}
                      alt="Cover preview"
                      draggable={false}
                      onDragStart={(event) => event.preventDefault()}
                      style={{ objectPosition: `${imagePosition.x}% ${imagePosition.y}%` }}
                    />
                    <button className="editor-image-move-button" type="button" onClick={() => { setMoveImage((active) => !active); stopImageDrag() }}>{moveImage ? 'Save' : 'Move'}</button>
                  </div>
                )}
              </section>
            </div>
            <section className="editor-content-panel">
              <div className="editor-content-heading">
                <div><strong>Article content</strong><span>Markdown supported</span></div>
                <div className="editor-mode-switch" role="group" aria-label="Content view">
                  <button type="button" className={!showPreview ? 'active' : ''} onClick={() => setShowPreview(false)}>Write</button>
                  <button type="button" className={showPreview ? 'active' : ''} onClick={() => setShowPreview(true)}>Preview</button>
                </div>
              </div>
              {showPreview ? (
                <div className="editor-live-preview">
                  <div className="editor-preview-scroll">
                    {content.trim() ? <MarkdownPreview content={content} /> : <p>Your article preview will appear here.</p>}
                  </div>
                </div>
              ) : (
                <textarea className="editor-content-input" value={content} onChange={(event) => setContent(event.target.value)} placeholder="Start writing your article…" required />
              )}
            </section>
          </div>
          <div className="editor-form-footer">
            {message && <p className="error-message">{message}</p>}
            <div className="editor-actions editor-page-actions">
              <a className="editor-cancel-link" href="#admin">Cancel</a>
              <button className="save-button editor-publish-button" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </form>
      </main>
    )
  }

  return (
    <main className="main-page admin-page">
      <div className="admin-heading">
        <div><h1>Admin</h1><p>Manage your home profile and published articles.</p></div>
        <button className="secondary-button" type="button" onClick={() => logoutAdmin().then(() => { setAuthenticated(false); window.location.hash = '#blog' }).catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'Logout failed.'))}>Log out</button>
      </div>
      <div className="admin-dashboard">
        <div className="admin-dashboard-stat"><span>Published articles</span><strong>{stats.articleCount}</strong></div>
        <a className="admin-dashboard-action" href="#admin/new">+ New article</a>
        <a className="admin-dashboard-action secondary" href="#blog">View blog</a>
      </div>
      {message && <p className="error-message">{message}</p>}
      <form className="admin-settings-form admin-home-profile-form" onSubmit={handleProfileSave}>
        <div><h2>首頁個人介紹</h2><p className="storage-note">更新後會儲存至 data/home-profile.json。</p></div>
        <label className="field-label">頭像<input type="file" accept="image/*" onChange={(event) => setProfileAvatar(event.target.files?.[0] ?? null)} /></label>
        {homeProfile.avatarUrl && <img className="admin-profile-avatar" src={homeProfile.avatarUrl} alt="目前頭像" />}
        <label className="field-label">名字<input value={homeProfile.name} onChange={(event) => setHomeProfile({ ...homeProfile, name: event.target.value })} /></label>
        <label className="field-label">簡介<textarea value={homeProfile.introduction} onChange={(event) => setHomeProfile({ ...homeProfile, introduction: event.target.value })} /></label>
        <label className="field-label">語錄<input value={homeProfile.quote} onChange={(event) => setHomeProfile({ ...homeProfile, quote: event.target.value })} /></label>
        <label className="field-label">社群連結（每行一個：名稱 | URL）<textarea value={socialLines} onChange={(event) => setSocialLines(event.target.value)} placeholder={'Instagram | https://…\nDiscord | https://…\nGitHub | https://…'} /></label>
        <label className="field-label">標籤（逗號分隔）<input value={tagText} onChange={(event) => setTagText(event.target.value)} placeholder="FRC, 科展" /></label>
        <label className="field-label">右欄標題<input value={homeProfile.updateTitle} onChange={(event) => setHomeProfile({ ...homeProfile, updateTitle: event.target.value })} /></label>
        <label className="field-label">右欄近期動態<textarea value={homeProfile.updateText} onChange={(event) => setHomeProfile({ ...homeProfile, updateText: event.target.value })} /></label>
        {profileMessage && <p className={profileMessage.includes('更新') ? 'save-message' : 'error-message'}>{profileMessage}</p>}
        <button className="save-button" type="submit" disabled={busy}>{busy ? '儲存中…' : '儲存首頁資料'}</button>
      </form>
      <section className="article-list">
        <h2>Articles</h2>
        {articles.length ? articles.map((article) => (
          <div className="admin-content-list" key={article.id}>
            <article><div><strong>{article.title}</strong><span>{article.category} · {new Date(article.publishedAt).toLocaleDateString()}</span></div><a href={`#admin/edit/${encodeURIComponent(article.id)}`}>Edit</a></article>
          </div>
        )) : <p>No articles yet.</p>}
      </section>
    </main>
  )
}

export default AdminPage
