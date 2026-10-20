import { useEffect, useState } from 'react'
import { fetchAdminActivity, fetchArticleStats, fetchArticles, type AdminActivity } from '../../features/blog/api'
import type { ArticleStats, ArticleSummary } from '../../features/blog/article'
import { getPublicPath } from '../../routes/routes'

const blankStats: ArticleStats = { articleCount: 0, categoryCount: 0, tagCount: 0, totalWords: 0, runtimeDays: 0, lastActivity: null }

function OverviewSection() {
  const [stats, setStats] = useState(blankStats)
  const [articles, setArticles] = useState<ArticleSummary[]>([])
  const [activity, setActivity] = useState<AdminActivity[]>([])

  useEffect(() => {
    fetchArticleStats().then(setStats).catch(() => undefined)
    fetchArticles().then(setArticles).catch(() => undefined)
    fetchAdminActivity().then(setActivity).catch(() => setActivity([]))
  }, [])

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

  return <div className="admin-overview-page">
          <section className="admin-welcome admin-mobile-home-link"><div><p className="admin-kicker">CONTENT DESK</p><h2>網站營運一覽</h2><p>管理首頁資訊與網站外觀；文章集中在 Blog 維護。</p></div><a className="ui-button ui-button-primary" href={getPublicPath('home')}>回到主頁 <span>↗</span></a></section>
          <div className="admin-metrics"><article><span>已發布文章</span><strong>{stats.articleCount}</strong><a href={getPublicPath('blog')}>在 Blog 管理 ↗</a></article><article><span>分類</span><strong>{stats.categoryCount}</strong><small>文章整理狀況</small></article><article><span>標籤</span><strong>{stats.tagCount}</strong><small>文章主題索引</small></article><article><span>文章總字數</span><strong>{stats.totalWords.toLocaleString()}</strong><small>已發布內容累積</small></article><article><span>網站運作</span><strong>{stats.runtimeDays.toLocaleString()}<em> 天</em></strong><small>持續更新中</small></article><article><span>最後更新</span><strong className="metric-date">{stats.lastActivity ? new Date(stats.lastActivity).toLocaleDateString() : '尚無紀錄'}</strong><small>最近發布文章</small></article></div>

          <div className="admin-overview-grid">
            <section className="admin-overview-card admin-content-trends"><div className="admin-overview-card-heading"><div><p className="admin-kicker">CONTENT RHYTHM</p><h2>內容更新趨勢</h2></div><a href={getPublicPath('blog')}>文章管理 ↗</a></div><p className="admin-overview-description">最近六個月的文章發布與更新紀錄。</p><div className="admin-month-chart">{contentMonths.map((month) => { const total = month.published + month.updated; return <div className="admin-month-column" key={month.label} title={`${month.label}：發布 ${month.published} 篇，更新 ${month.updated} 篇`}><strong>{total || ''}</strong><div className="admin-month-bar"><i style={{ height: `${(month.published / maxContentMonth) * 100}%` }} /><b style={{ height: `${(month.updated / maxContentMonth) * 100}%` }} /></div><small>{month.label}</small></div> })}</div><div className="admin-chart-legend"><span><i />發布</span><span><i />更新</span></div><div className="admin-category-list"><h3>文章分類</h3>{topCategories.length ? topCategories.map(([name, count]) => <div key={name}><span>{name}</span><i><b style={{ width: `${Math.max(5, count / Math.max(1, stats.articleCount) * 100)}%` }} /></i><strong>{count}</strong></div>) : <p>目前還沒有文章分類。</p>}</div></section>

          </div>
          <section className="admin-overview-card admin-activity-card"><div className="admin-overview-card-heading"><div><p className="admin-kicker">RECENT CHANGES</p><h2>近期活動</h2></div><span>最近 50 筆</span></div>{activity.length ? <div className="admin-activity-list">{activity.slice(0, 6).map((item, index) => <div key={`${item.at}-${index}`}><i className={`activity-mark ${item.type}`} /><span><strong>{item.title}</strong><small>{item.type === 'article' ? item.action === 'published' ? '發布文章' : item.action === 'updated' ? '更新文章' : '刪除文章' : item.type === 'homepage' ? '儲存首頁內容' : '儲存網站設定'}</small></span><time>{new Date(item.at).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</time></div>)}</div> : <p className="admin-activity-empty">儲存首頁或網站設定、發布文章後，活動紀錄會顯示在這裡。</p>}</section>
        </div>
}

export default OverviewSection
