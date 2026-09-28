import { useEffect, useRef, useState } from 'react'
import MarkdownPreview from '../components/MarkdownPreview'
import FileDropzone from '../components/FileDropzone'
import { deleteArticle, fetchAdminSession, fetchArticleStats, fetchArticles, publishArticle, recordPageView, updateArticle } from '../features/blog/api'
import type { Article, ArticleStats } from '../features/blog/article'

const emptyStats: ArticleStats = {
  articleCount: 0,
  categoryCount: 0,
  tagCount: 0,
  totalWords: 0,
  runtimeDays: 0,
  lastActivity: null,
}

function BlogPage() {
  const [articles, setArticles] = useState<Article[]>([])
  const [stats, setStats] = useState<ArticleStats>(emptyStats)
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null)
  const [currentTime] = useState(() => Date.now())
  const [isAdmin, setIsAdmin] = useState(false)
  const [adminMessage, setAdminMessage] = useState('')
  const [editor, setEditor] = useState<{ mode: 'new' | 'edit'; id?: string } | null>(null)
  const [draftTitle, setDraftTitle] = useState('')
  const [draftCategory, setDraftCategory] = useState('')
  const [draftTags, setDraftTags] = useState('')
  const [draftContent, setDraftContent] = useState('')
  const [draftCover, setDraftCover] = useState<File | null>(null)
  const [draftBusy, setDraftBusy] = useState(false)
  const [draftPreview, setDraftPreview] = useState(false)
  const articleViewportRef = useRef<HTMLDivElement>(null)
  const sidebarOuterRef = useRef<HTMLElement>(null)
  const sidebarContentRef = useRef<HTMLDivElement>(null)
  const [sidebarFit, setSidebarFit] = useState({ shift: 0, scale: 1 })

  useEffect(() => {
    if (selectedArticle && !isAdmin) void recordPageView('article', { articleId: selectedArticle.id })
  }, [selectedArticle, isAdmin])

  const recentArticles = articles.filter((article) => {
    const publishedAt = new Date(article.publishedAt).getTime()
    return currentTime - publishedAt <= 7 * 86_400_000
  })

  const tagCounts = articles.reduce<Record<string, number>>((counts, article) => {
    article.tags.forEach((tag) => {
      counts[tag] = (counts[tag] ?? 0) + 1
    })
    return counts
  }, {})

  const popularTags = Object.entries(tagCounts)
    .sort((first, second) => second[1] - first[1])
    .slice(0, 5)

  useEffect(() => {
    Promise.all([fetchArticles(), fetchArticleStats(), fetchAdminSession()])
      .then(([loadedArticles, loadedStats, session]) => {
        setArticles(loadedArticles)
        setStats(loadedStats)
        setIsAdmin(session.authenticated)
      })
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    const sync = () => {
      const [, action, rawId] = window.location.hash.slice(1).split('/')
      if (action !== 'new' && action !== 'edit') { setEditor(null); return }
      if (!isAdmin) return
      const id = rawId ? decodeURIComponent(rawId) : undefined
      const article = action === 'edit' ? articles.find((item) => item.id === id) : undefined
      setEditor({ mode: action, ...(id ? { id } : {}) })
      setDraftTitle(article?.title ?? '')
      setDraftCategory(article?.category ?? '')
      setDraftTags(article?.tags.join(', ') ?? '')
      setDraftContent(article?.content ?? '')
      setDraftCover(null)
      setDraftPreview(false)
      setAdminMessage('')
    }
    sync()
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [isAdmin, articles])

  async function saveDraft(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData()
    form.set('title', draftTitle); form.set('category', draftCategory); form.set('tags', draftTags); form.set('content', draftContent)
    if (draftCover) form.set('coverImage', draftCover)
    setDraftBusy(true); setAdminMessage('')
    try {
      const saved = editor?.mode === 'edit' && editor.id ? await updateArticle(editor.id, form) : await publishArticle(form)
      setArticles((current) => editor?.mode === 'edit' ? current.map((item) => item.id === saved.id ? saved : item) : [saved, ...current])
      fetchArticleStats().then(setStats).catch(() => undefined)
      window.location.hash = '#blog'
    } catch (error) { setAdminMessage(error instanceof Error ? error.message : '儲存文章失敗。') }
    finally { setDraftBusy(false) }
  }

  // Move both columns up together first. If the sidebar still does not fit
  // between the topbar and bottom edge, scale its contents to fit that space.
  useEffect(() => {
    const lastFit = { shift: sidebarFit.shift, scale: sidebarFit.scale }
    let frameId = 0

    function measure() {
      const articleEl = articleViewportRef.current
      const outerEl = sidebarOuterRef.current
      const contentEl = sidebarContentRef.current
      if (!articleEl || !outerEl || !contentEl || window.innerWidth <= 768) {
        return { shift: 0, scale: 1 }
      }

      const articleBottom = articleEl.getBoundingClientRect().bottom
      const outerTop = outerEl.getBoundingClientRect().top
      const naturalHeight = contentEl.scrollHeight
      const topbarEl = document.querySelector('.topbar')
      const minTop = (topbarEl?.getBoundingClientRect().bottom ?? 0) + 16
      const bottomGap = 0
      // The workspace has already moved by the current shift, so restore it
      // when measuring the unshifted overflow and available travel distance.
      const unshiftedTop = outerTop + sidebarFit.shift
      const overflow = unshiftedTop + naturalHeight - (articleBottom - bottomGap)
      if (overflow <= 0) return { shift: 0, scale: 1 }

      const maxShift = Math.max(0, unshiftedTop - minTop)
      const shift = Math.min(overflow, maxShift)
      const remainingOverflow = Math.max(0, overflow - shift)
      if (remainingOverflow <= 0) return { shift, scale: 1 }

      const availableHeight = Math.max(1, articleBottom - bottomGap - (unshiftedTop - shift))
      const scale = Math.min(1, availableHeight / naturalHeight)
      return { shift, scale }
    }

    function recalculate() {
      cancelAnimationFrame(frameId)
      frameId = requestAnimationFrame(() => {
        const next = measure()
        // Ignore sub-pixel noise so ResizeObserver can't retrigger itself endlessly.
        if (Math.abs(next.shift - lastFit.shift) < 0.5 && Math.abs(next.scale - lastFit.scale) < 0.002) {
          return
        }
        lastFit.shift = next.shift
        lastFit.scale = next.scale
        setSidebarFit(next)
      })
    }

    recalculate()

    const resizeObserver = new ResizeObserver(recalculate)
    if (articleViewportRef.current) resizeObserver.observe(articleViewportRef.current)
    if (sidebarContentRef.current) resizeObserver.observe(sidebarContentRef.current)
    window.addEventListener('resize', recalculate)

    return () => {
      cancelAnimationFrame(frameId)
      resizeObserver.disconnect()
      window.removeEventListener('resize', recalculate)
    }
  }, [articles, recentArticles.length, stats, popularTags.length, sidebarFit.shift, sidebarFit.scale])

  if (editor && isAdmin) return <main className="main-page blog-screen blog-editor-screen">
    <form className="blog-editor-form" onSubmit={saveDraft}><header><div><small>BLOG CONTENT</small><h1>{editor.mode === 'new' ? '撰寫文章' : '編輯文章'}</h1><p>文章集中在 Blog 管理，儲存後會更新文章列表。</p></div><a href="#blog">返回 Blog</a></header>
      <div className="blog-editor-meta"><label>文章標題<input value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} placeholder="輸入文章標題" required /></label><label>分類<input value={draftCategory} onChange={(event) => setDraftCategory(event.target.value)} placeholder="未分類" /></label><label>標籤<input value={draftTags} onChange={(event) => setDraftTags(event.target.value)} placeholder="以逗號分隔" /></label><div className="blog-upload-field"><span>封面圖片</span><FileDropzone title="上傳文章封面" file={draftCover} previewUrl={articles.find((article) => article.id === editor.id)?.coverImage} onFile={setDraftCover} /></div></div>
      <div className="blog-editor-writing"><div className="blog-editor-toolbar"><strong>文章內容 <span>支援 Markdown</span></strong><div><button type="button" className={!draftPreview ? 'active' : ''} onClick={() => setDraftPreview(false)}>編輯</button><button type="button" className={draftPreview ? 'active' : ''} onClick={() => setDraftPreview(true)}>預覽</button></div></div>{draftPreview ? <div className="blog-editor-preview">{draftContent ? <MarkdownPreview content={draftContent} /> : <p>輸入內容後會在這裡預覽。</p>}</div> : <textarea value={draftContent} onChange={(event) => setDraftContent(event.target.value)} placeholder="開始撰寫…" required />}</div>
      {adminMessage && <p className="error-message">{adminMessage}</p>}<footer><a href="#blog">取消</a><button className="save-button" disabled={draftBusy}>{draftBusy ? '儲存中…' : '儲存文章'}</button></footer>
    </form>
  </main>

  return (
    <main className="main-page blog-screen">
      <section
        className="blog-workspace"
        style={{ '--blog-shift': `${sidebarFit.shift}px` } as React.CSSProperties}
      >
        <div className="blog-article-viewport blog-article-test-surface" ref={articleViewportRef}>
          {articles.length === 0 ? (
            <div className="blog-empty-state">
              <strong>暫無文章</strong>
              <span>新內容發布後會顯示在這裡。</span>
            </div>
          ) : (
            articles.map((article) => (
              <div key={article.id} className="article-card-wrap">
              <button className="public-article-card" type="button" onClick={() => setSelectedArticle(article)}>
                {article.coverImage && <img src={article.coverImage} alt="" />}
                <span>
                  <small>{article.category} · {new Date(article.publishedAt).toLocaleDateString()}</small>
                  <strong>{article.title}</strong>
                  <p>
                    {article.content
                      .replaceAll('#', '')
                      .replaceAll('*', '')
                      .replaceAll('`', '')
                      .replaceAll('>', '')
                      .replaceAll('[', '')
                      .replaceAll(']', '')
                      .replaceAll('!', '')
                      .replaceAll('_', '')
                      .replaceAll('~', '')
                      .slice(0, 110)}...
                  </p>
                  <em>{article.tags.map((tag) => `#${tag}`).join(' ')}</em>
                </span>
              </button>
              </div>
            ))
          )}
        </div>
        <aside className="blog-sidebar-viewport" ref={sidebarOuterRef}>
          <div
            className="blog-sidebar-content"
            ref={sidebarContentRef}
            style={{ transform: `scale(${sidebarFit.scale})` }}
          >
          <section className="recent-articles">
            <div className="side-card-heading"><span />最新動態</div>
            {recentArticles.length === 0 ? (
              <p className="side-empty">還沒有發布動態</p>
            ) : (
              recentArticles.map((article) => (
                <button key={article.id} type="button" onClick={() => setSelectedArticle(article)}>
                  <strong>{article.title}</strong>
                  <span>{new Date(article.publishedAt).toLocaleDateString()}</span>
                </button>
              ))
            )}
          </section>
          <section className="site-stats">
            <div className="side-card-heading"><span />站點統計</div>
            <div className="stat-row"><span>文章</span><strong>{stats.articleCount}</strong></div>
            <div className="stat-row"><span>分類</span><strong>{stats.categoryCount}</strong></div>
            <div className="stat-row"><span>標籤</span><strong>{stats.tagCount}</strong></div>
            <div className="stat-row"><span>總字數</span><strong>{stats.totalWords.toLocaleString()}</strong></div>
            <div className="stat-row"><span>運行時長</span><strong>{stats.runtimeDays} 天</strong></div>
            <div className="stat-row"><span>最後活動</span><strong>{stats.lastActivity ? new Date(stats.lastActivity).toLocaleDateString() : '—'}</strong></div>
          </section>
          <section className="popular-tags-card">
            <div className="side-card-heading"><span />熱門標籤</div>
            {popularTags.length === 0 ? (
              <p className="side-empty">還沒有標籤</p>
            ) : (
              <div className="popular-tags">
                {popularTags.map(([tag, count]) => <span key={tag}>#{tag} <strong>{count}</strong></span>)}
              </div>
            )}
          </section>
          </div>
        </aside>
      </section>

      {selectedArticle && (
        <div className="article-reader-backdrop" role="presentation" onClick={() => setSelectedArticle(null)}>
          <article className="article-reader" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="secondary-button" onClick={() => setSelectedArticle(null)}>Close</button>
            <p className="placeholder-label">{selectedArticle.category} · {new Date(selectedArticle.publishedAt).toLocaleDateString()}</p>
            <h2>{selectedArticle.title}</h2>
            {selectedArticle.coverImage && <img src={selectedArticle.coverImage} alt="" />}
            <MarkdownPreview content={selectedArticle.content} />
            {isAdmin && (
              <div className="article-admin-actions">
                <a href={`#blog/edit/${encodeURIComponent(selectedArticle.id)}`}>編輯文章</a>
                <button type="button" onClick={() => {
                  if (window.confirm(`Delete "${selectedArticle.title}"?`)) {
                    deleteArticle(selectedArticle.id)
                      .then(() => {
                        setArticles((current) => current.filter((item) => item.id !== selectedArticle.id))
                        setSelectedArticle(null)
                      })
                      .catch((deleteError) => setAdminMessage(deleteError instanceof Error ? deleteError.message : 'Delete failed.'))
                  }
                }}>Delete</button>
              </div>
            )}
            {adminMessage && <p className="error-message">{adminMessage}</p>}
          </article>
        </div>
      )}
      {isAdmin && <a className="new-article-button" href="#blog/new">＋ 撰寫文章</a>}
    </main>
  )
}

export default BlogPage
