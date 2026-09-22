import { useEffect, useState } from 'react'
import MarkdownPreview from '../components/MarkdownPreview'
import { deleteArticle, fetchAdminSession, fetchArticleStats, fetchArticles } from '../features/blog/api'
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

  return (
    <main className="main-page blog-screen">
      <section className="blog-workspace">
        <div className="blog-article-viewport blog-article-test-surface">
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
        <aside className="blog-sidebar-viewport">
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
                <a href={`#admin/edit/${selectedArticle.id}`}>Edit</a>
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
      {isAdmin && <a className="new-article-button" href="#admin/new">+ New article</a>}
    </main>
  )
}

export default BlogPage
