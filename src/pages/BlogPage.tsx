import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import ArticleReader from '../components/ArticleReader'
import ConfirmDialog from '../components/ConfirmDialog'
import UiIcon from '../components/UiIcon'
import { deleteArticle, fetchAdminSession, fetchArticleStats, fetchArticles, recordPageView } from '../features/blog/api'
import type { ArticleStats, ArticleSummary } from '../features/blog/article'
import { getPublicPath, getRouteSegments, navigate, useLocationKey } from '../routes/routes'
import CoverImage from '../components/CoverImage'

const ArticleEditor = lazy(() => import('./blog/ArticleEditor'))

const emptyStats: ArticleStats = {
  articleCount: 0,
  categoryCount: 0,
  tagCount: 0,
  totalWords: 0,
  runtimeDays: 0,
  lastActivity: null,
}

function BlogPage() {
  const [articles, setArticles] = useState<ArticleSummary[]>([])
  const [stats, setStats] = useState<ArticleStats>(emptyStats)
  const [articleToDelete, setArticleToDelete] = useState<ArticleSummary | null>(null)
  const [currentTime] = useState(() => Date.now())
  const [isAdmin, setIsAdmin] = useState(false)
  const [adminMessage, setAdminMessage] = useState('')
  const articleViewportRef = useRef<HTMLDivElement>(null)
  const sidebarOuterRef = useRef<HTMLElement>(null)
  const sidebarContentRef = useRef<HTMLDivElement>(null)
  const [sidebarFit, setSidebarFit] = useState({ shift: 0, scale: 1, height: 0 })
  const locationKey = useLocationKey()
  // The open article lives in the URL (/blog/post/:id), so it can be shared and Back closes it.
  const [, routeAction, routeId] = getRouteSegments()
  const selectedArticle = routeAction === 'post' ? articles.find((article) => article.id === decodeURIComponent(routeId ?? '')) ?? null : null
  const articlePath = (article: ArticleSummary) => `${getPublicPath('blog')}/post/${encodeURIComponent(article.id)}`
  const closeArticle = () => navigate(getPublicPath('blog'))

  useEffect(() => {
    if (selectedArticle && !isAdmin) void recordPageView('article', { articleId: selectedArticle.id })
  }, [selectedArticle, isAdmin])

  const recentArticles = useMemo(() => articles.filter((article) => {
    const publishedAt = new Date(article.publishedAt).getTime()
    return currentTime - publishedAt <= 7 * 86_400_000
  }), [articles, currentTime])
  const visibleRecentArticles = recentArticles.slice(0, 4)
  const recentArticlePlaceholders = Math.max(0, 5 - visibleRecentArticles.length)

  const popularTags = useMemo(() => {
    const tagCounts = new Map<string, number>()
    for (const article of articles) for (const tag of article.tags) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1)
    return [...tagCounts].sort((first, second) => second[1] - first[1]).slice(0, 5)
  }, [articles])

  useEffect(() => {
    Promise.all([fetchArticles(), fetchArticleStats(), fetchAdminSession()])
      .then(([loadedArticles, loadedStats, session]) => {
        setArticles(loadedArticles)
        setStats(loadedStats)
        setIsAdmin(session.authenticated)
      })
      .catch(() => undefined)
  }, [])

  const editor = useMemo(() => {
    void locationKey
    const [, action, rawId] = getRouteSegments()
    if (action !== 'new' && action !== 'edit') return null
    return { mode: action, id: rawId ? decodeURIComponent(rawId) : undefined }
  }, [locationKey])

  async function confirmArticleDelete() {
    if (!articleToDelete) return
    try {
      await deleteArticle(articleToDelete.id)
      setArticles((current) => current.filter((item) => item.id !== articleToDelete.id))
      if (selectedArticle?.id === articleToDelete.id) closeArticle()
      setArticleToDelete(null)
    } catch (error) {
      setAdminMessage(error instanceof Error ? error.message : 'Delete failed.')
    }
  }

  function articleSaved(saved: ArticleSummary) {
    setArticles((current) => current.some((item) => item.id === saved.id) ? current.map((item) => item.id === saved.id ? saved : item) : [saved, ...current])
    fetchArticleStats().then(setStats).catch(() => undefined)
    // Land on the saved article, so the result can be read right away.
    navigate(`${getPublicPath('blog')}/post/${encodeURIComponent(saved.id)}`, { replace: true })
  }

  // Keep the desktop workspace below the topbar's 25vh breathing room.
  // If the sidebar is taller than the measured card range, scale its contents
  // instead of moving the article cards into the topbar.
  useEffect(() => {
    const lastFit = { shift: sidebarFit.shift, scale: sidebarFit.scale, height: sidebarFit.height }
    let frameId = 0

    function measure() {
      const articleEl = articleViewportRef.current
      const outerEl = sidebarOuterRef.current
      const contentEl = sidebarContentRef.current
      if (!articleEl || !outerEl || !contentEl || window.innerWidth <= 768) {
        return { shift: 0, scale: 1, height: 0 }
      }

      const articleCards = articleEl.querySelectorAll<HTMLElement>('.article-card-wrap')
      const firstCard = articleCards[0]
      const secondCard = articleCards[1]
      const articleGap = Number.parseFloat(getComputedStyle(articleEl).rowGap) || 0
      const firstCardRect = firstCard?.getBoundingClientRect()
      const outerTop = outerEl.getBoundingClientRect().top
      const articleBottom = articleEl.getBoundingClientRect().bottom
      const targetBottom = articleCards.length >= 3
        ? articleBottom + sidebarFit.shift
        : secondCard?.getBoundingClientRect().bottom
          ?? (firstCardRect ? firstCardRect.bottom + firstCardRect.height + articleGap : articleBottom)
      const naturalHeight = contentEl.scrollHeight
      const topbarEl = document.querySelector('.topbar')
      const preferredTop = (topbarEl?.getBoundingClientRect().bottom ?? 0) + window.innerHeight * 0.25
      const bottomGap = 0
      // The workspace has already moved by the current shift, so restore it
      // when measuring the unshifted overflow and available travel distance.
      const unshiftedTop = outerTop + sidebarFit.shift
      const overflow = unshiftedTop + naturalHeight - (targetBottom - bottomGap)
      if (overflow <= 0) return { shift: 0, scale: 1, height: Math.max(1, targetBottom - unshiftedTop) }

      const maxShift = Math.max(0, unshiftedTop - preferredTop)
      const shift = Math.min(overflow, maxShift)
      const remainingOverflow = Math.max(0, overflow - shift)
      const availableHeight = Math.max(1, targetBottom - bottomGap - (unshiftedTop - shift))
      if (remainingOverflow <= 0) return { shift, scale: 1, height: availableHeight }

      const scale = Math.min(1, availableHeight / naturalHeight)
      return { shift, scale, height: availableHeight }
    }

    function recalculate() {
      cancelAnimationFrame(frameId)
      frameId = requestAnimationFrame(() => {
        const next = measure()
        // Ignore sub-pixel noise so ResizeObserver can't retrigger itself endlessly.
        if (Math.abs(next.shift - lastFit.shift) < 0.5 && Math.abs(next.scale - lastFit.scale) < 0.002 && Math.abs(next.height - lastFit.height) < 0.5) {
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
  }, [articles, recentArticles.length, stats, popularTags.length, sidebarFit.shift, sidebarFit.scale, sidebarFit.height])

  const editing = editor?.mode === 'edit' ? articles.find((item) => item.id === editor.id) : undefined
  const editorReady = Boolean(editor && isAdmin && (editor.mode === 'new' || editing))

  return (
    <main className="main-page blog-screen">
      <section
        className={`blog-workspace${articles.length ? ' blog-workspace-multiple-articles' : ''}`}
        style={{
          '--blog-shift': `${sidebarFit.shift}px`,
          '--blog-sidebar-height': sidebarFit.height > 0 ? `${sidebarFit.height}px` : undefined,
        } as React.CSSProperties}
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
              <a className="public-article-card" data-article-id={article.id} href={articlePath(article)}>
                <div>
                  {article.coverImage && <CoverImage src={article.coverImage} position={article.coverImagePosition} scale={article.coverImageScale} />}
                  <span>
                    <small>{article.category} · {new Date(article.publishedAt).toLocaleDateString()}</small>
                    <strong>{article.title}</strong>
                    <p>{article.excerpt.slice(0, 110)}...</p>
                    <em>{article.tags.map((tag) => `#${tag}`).join(' ')}</em>
                  </span>
                </div>
              </a>
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
              visibleRecentArticles.map((article) => (
                <a key={article.id} href={articlePath(article)}>
                  <strong>{article.title}</strong>
                  <span>{new Date(article.publishedAt).toLocaleDateString()}</span>
                </a>
              ))
            )}
            {recentArticlePlaceholders > 0 && Array.from({ length: recentArticlePlaceholders }, (_, index) => (
              <span className="recent-article-placeholder" aria-hidden="true" key={`recent-placeholder-${index}`} />
            ))}
          </section>
          <section className="site-stats">
            <div className="side-card-heading"><span />站點統計</div>
            <div className="stat-row"><span>文章</span><strong>{stats.articleCount}</strong></div>
            <div className="stat-row"><span>分類</span><strong>{stats.categoryCount}</strong></div>
            <div className="stat-row"><span>標籤</span><strong>{stats.tagCount}</strong></div>
            <div className="stat-row"><span>總字數</span><strong>{stats.totalWords.toLocaleString()}</strong></div>
            <div className="stat-row"><span>最後活動</span><strong>{stats.lastActivity ? new Date(stats.lastActivity).toLocaleDateString() : '—'}</strong></div>
            <a className="blog-rss-link" href="/api/rss.xml" target="_blank" rel="noreferrer">訂閱 RSS</a>
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
        <ArticleReader article={selectedArticle} onClose={closeArticle}>
          {isAdmin && (
            <footer className="project-detail-actions">
              <div className="project-detail-admin-actions">
                <a className="ui-button ui-button-secondary" href={`${getPublicPath('blog')}/edit/${encodeURIComponent(selectedArticle.id)}`}><UiIcon name="edit" />編輯</a>
                <button type="button" className="ui-button ui-button-danger" onClick={() => setArticleToDelete(selectedArticle)}><UiIcon name="trash" />刪除</button>
              </div>
            </footer>
          )}
          {adminMessage && <p className="error-message">{adminMessage}</p>}
        </ArticleReader>
      )}
      {isAdmin && <a className="ui-button ui-button-primary ui-button-floating" href={`${getPublicPath('blog')}/new`}><UiIcon name="plus" />撰寫文章</a>}
      {editorReady && <Suspense fallback={null}>
        <ArticleEditor key={editing?.id ?? 'new'} article={editing} onSaved={articleSaved} onClose={() => navigate(getPublicPath('blog'))} />
      </Suspense>}
      <ConfirmDialog
        open={Boolean(articleToDelete)}
        title="刪除這篇文章？"
        message={articleToDelete ? `「${articleToDelete.title}」刪除後將無法復原。` : ''}
        onConfirm={confirmArticleDelete}
        onCancel={() => setArticleToDelete(null)}
      />
    </main>
  )
}

export default BlogPage
