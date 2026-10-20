import { useCallback, useEffect, useState } from 'react'
import { fetchAnalyticsStats, fetchAnalyticsVisits } from '../../features/blog/api'
import type { AnalyticsCount, AnalyticsLocation, AnalyticsStats, AnalyticsVisit } from '../../features/blog/article'

type SectionProps = { onMessage: (message: string) => void }
type Period = 1 | 7 | 30

const blankAnalytics: AnalyticsStats = {
  days: 7, totalViews: 0, previousViews: 0, regionCount: 0, topRegions: [], daily: [], topPages: [], topArticles: [],
  sources: { direct: 0, search: 0, social: 0, referral: 0 }, devices: { mobile: 0, tablet: 0, desktop: 0 },
  trackedViews: 0, uniqueVisitors: 0, sessions: 0, returningVisitors: 0, hourlyUtc: Array.from({ length: 24 }, () => 0),
  browsers: [], operatingSystems: [], referrers: [], topPaths: [], topIps: [], regionLocations: [], cityLocations: [], eventsSince: null, eventRetentionDays: 90,
}
const periods: { days: Period; label: string }[] = [{ days: 1, label: '今天' }, { days: 7, label: '7 天' }, { days: 30, label: '30 天' }]
const sourceLabels = [{ key: 'search', label: '搜尋引擎' }, { key: 'social', label: '社群平台' }, { key: 'referral', label: '外部連結' }, { key: 'direct', label: '直接進站' }] as const
const deviceLabels: Record<string, string> = { desktop: '桌面', mobile: '手機', tablet: '平板' }
const pageLabels: Record<string, string> = { home: '首頁', about: '關於', projects: '作品', blog: 'Blog', article: '文章', contact: '聯絡', friends: '友站' }

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function formatLocation(country: string, region: string, city = '') {
  return country ? [country, region && region !== '未細分' ? region : '', city].filter(Boolean).join(' ') : '—'
}

function LocationCard({ title, description, items, detail }: { title: string; description: string; items: AnalyticsLocation[]; detail: 'region' | 'city' }) {
  const max = items[0]?.views || 1
  return <section className="admin-traffic-card admin-region-card">
    <div className="admin-traffic-card-heading"><div><h3>{title}</h3><p>{description}</p></div></div>
    {items.length ? <div className="admin-region-list">{items.map((item) => {
      const name = detail === 'city' ? item.city || '僅定位到縣市' : item.region || '未細分'
      const parent = detail === 'city' ? [item.country, item.region].filter(Boolean).join(' · ') : item.country
      return <div className="admin-region-row" key={`${item.country}-${item.region}-${item.city ?? ''}`}>
        <span><strong>{name}</strong><small>{parent}</small></span>
        <i><b style={{ width: `${Math.round(item.views / max * 100)}%` }} /></i>
        <strong className="admin-region-count">{item.views.toLocaleString()} <small>次 · {item.visitors.toLocaleString()} IP</small></strong>
      </div>
    })}</div> : <p className="admin-traffic-no-pages">逐筆紀錄累積後顯示。</p>}
  </section>
}

// Rotates UTC hour buckets into the viewer's local time zone.
function toLocalHours(hourlyUtc: number[]) {
  const offset = Math.round(-new Date().getTimezoneOffset() / 60)
  return Array.from({ length: 24 }, (_unused, hour) => hourlyUtc[(hour - offset + 48) % 24] ?? 0)
}

function RankingCard({ title, description, items, empty, label = (key) => key }: { title: string; description: string; items: AnalyticsCount[]; empty: string; label?: (key: string) => string }) {
  const max = items[0]?.views || 1
  return <section className="admin-traffic-card admin-top-pages">
    <div className="admin-traffic-card-heading"><div><h3>{title}</h3><p>{description}</p></div></div>
    {items.length ? <div className="admin-top-pages-list">{items.map((item, index) => <div key={item.key}>
      <span className="traffic-rank">{String(index + 1).padStart(2, '0')}</span>
      <strong title={item.key}>{label(item.key)}</strong>
      <div className="admin-page-views-track"><i style={{ width: `${Math.max(4, item.views / max * 100)}%` }} /></div>
      <span>{item.views.toLocaleString()} <small>次</small></span>
    </div>)}</div> : <p className="admin-traffic-no-pages">{empty}</p>}
  </section>
}

function VisitLog({ ipFilter, onIpFilter, refresh, onMessage }: { ipFilter: string; onIpFilter: (ip: string) => void; refresh: number; onMessage: (message: string) => void }) {
  const [visits, setVisits] = useState<AnalyticsVisit[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const [draft, setDraft] = useState(ipFilter)

  const load = useCallback(async (before?: number) => {
    setLoading(true)
    try {
      const result = await fetchAnalyticsVisits({ ip: ipFilter || undefined, before })
      setVisits((current) => before ? [...current, ...result.visits] : result.visits)
      setHasMore(result.hasMore)
    } catch (error) {
      onMessage(error instanceof Error ? error.message : '無法載入瀏覽紀錄。')
    } finally {
      setLoading(false)
    }
  }, [ipFilter, onMessage])

  useEffect(() => {
    queueMicrotask(() => { setDraft(ipFilter); void load() })
  }, [load, refresh, ipFilter])

  return <section className="admin-traffic-card admin-visit-card">
    <div className="admin-traffic-card-heading">
      <div><h3>瀏覽紀錄</h3><p>每一次頁面瀏覽都會記錄（包含重複瀏覽），依時間由新到舊。</p></div>
      <form className="admin-ip-filter" onSubmit={(event) => { event.preventDefault(); onIpFilter(draft.trim()) }}>
        <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="篩選 IP" aria-label="篩選 IP" />
        <button type="submit" className="ui-button ui-button-secondary ui-button-small">篩選</button>
        {ipFilter && <button type="button" className="ui-button ui-button-secondary ui-button-small" onClick={() => onIpFilter('')}>清除</button>}
      </form>
    </div>
    {visits.length ? <div className="admin-table-scroll"><table className="admin-traffic-table">
      <thead><tr><th>時間</th><th>IP</th><th>頁面</th><th>地區</th><th>裝置</th><th>來源</th><th>工作階段</th></tr></thead>
      <tbody>{visits.map((visit) => <tr key={visit.id}>
        <td className="admin-table-nowrap">{formatDateTime(visit.at)}</td>
        <td><button type="button" className="admin-ip-link" onClick={() => onIpFilter(visit.ip)}>{visit.ip}</button></td>
        <td><strong>{visit.articleTitle || pageLabels[visit.page] || visit.page}</strong><small>{visit.path || '—'}</small></td>
        <td>{formatLocation(visit.country, visit.region, visit.city)}</td>
        <td title={visit.userAgent}>{deviceLabels[visit.device] ?? visit.device}<small>{visit.browser} · {visit.os}</small></td>
        <td>{visit.referrer || (visit.source ? sourceLabels.find((item) => item.key === visit.source)?.label : '—')}</td>
        <td><code>{visit.sessionId ? visit.sessionId.slice(0, 8) : '—'}</code></td>
      </tr>)}</tbody>
    </table></div> : <p className="admin-traffic-no-pages">{loading ? '載入中…' : ipFilter ? `沒有 ${ipFilter} 的瀏覽紀錄。` : '目前還沒有瀏覽紀錄。'}</p>}
    {hasMore && <div className="admin-visit-more"><button type="button" className="ui-button ui-button-secondary ui-button-small" disabled={loading} onClick={() => void load(visits.at(-1)?.id)}>{loading ? '載入中…' : '載入更多'}</button></div>}
  </section>
}

function TrafficSection({ onMessage }: SectionProps) {
  const [analytics, setAnalytics] = useState(blankAnalytics)
  const [analyticsDays, setAnalyticsDays] = useState<Period>(7)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [analyticsRefresh, setAnalyticsRefresh] = useState(0)
  const [ipFilter, setIpFilter] = useState('')

  useEffect(() => {
    let active = true
    queueMicrotask(() => { if (active) setAnalyticsLoading(true) })
    fetchAnalyticsStats(analyticsDays)
      .then((result) => { if (active) setAnalytics(result) })
      .catch((error: unknown) => { if (active) onMessage(error instanceof Error ? error.message : '無法載入流量資料。') })
      .finally(() => { if (active) setAnalyticsLoading(false) })
    return () => { active = false }
  }, [analyticsDays, analyticsRefresh, onMessage])

  const maxDailyViews = Math.max(1, ...analytics.daily.map((item) => item.views))
  const localHours = toLocalHours(analytics.hourlyUtc)
  const maxHourlyViews = Math.max(1, ...localHours)
  const deviceTotal = analytics.devices.mobile + analytics.devices.tablet + analytics.devices.desktop
  const mobileShare = deviceTotal ? Math.round((analytics.devices.mobile / deviceTotal) * 100) : 0
  const topPage = analytics.topPages[0]
  const topRegion = analytics.topRegions[0]
  const changePercent = analytics.previousViews ? Math.round(((analytics.totalViews - analytics.previousViews) / analytics.previousViews) * 100) : null
  const sourceTotal = Object.values(analytics.sources).reduce((total, views) => total + views, 0)
  const repeatViews = Math.max(0, analytics.trackedViews - analytics.uniqueVisitors)
  const viewsPerVisitor = analytics.uniqueVisitors ? (analytics.trackedViews / analytics.uniqueVisitors).toFixed(1) : '0'
  const periodLabel = analyticsDays === 1 ? '今天' : `${analyticsDays} 天`
  const showIp = (ip: string) => {
    setIpFilter(ip)
    document.querySelector('.admin-visit-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return <section className="admin-traffic-page">
    <div className="admin-traffic-heading">
      <div>
        <p className="admin-kicker">SITE ANALYTICS</p>
        <h2>流量分析</h2>
        <p>每次瀏覽都會記錄訪客 IP、頁面、時間與裝置；重複瀏覽同樣計入。</p>
        <span className="admin-traffic-tracking"><i aria-hidden="true" />逐筆紀錄保留 {analytics.eventRetentionDays} 天</span>
      </div>
      <button className="admin-refresh-button" onClick={() => setAnalyticsRefresh((value) => value + 1)} disabled={analyticsLoading}>{analyticsLoading ? '更新中…' : '↻ 更新資料'}</button>
    </div>

    <div className="admin-traffic-toolbar">
      <span>統計期間</span>
      <div className="admin-period-switch" aria-label="選擇統計期間">{periods.map(({ days, label }) => <button key={days} className={analyticsDays === days ? 'active' : ''} onClick={() => setAnalyticsDays(days)}>{label}</button>)}</div>
      <small>每日 UTC 統計</small>
    </div>

    <div className="admin-traffic-kpis">
      <article><span>總瀏覽量</span><strong>{analytics.totalViews.toLocaleString()}</strong><small>{changePercent === null ? '前期尚無資料' : `${changePercent > 0 ? '+' : ''}${changePercent}% 對比前 ${periodLabel}`}</small></article>
      <article><span>已辨識地區</span><strong>{analytics.regionCount.toLocaleString()}</strong><small>{topRegion ? `最多瀏覽：${topRegion.country} ${topRegion.region}` : '僅計有地區資料的彙總'}</small></article>
      <article><span>每日平均</span><strong>{Math.round(analytics.totalViews / analyticsDays).toLocaleString()}</strong><small>此期間每日頁面瀏覽</small></article>
      <article><span>主要瀏覽頁面</span><strong className="traffic-kpi-text">{topPage?.label ?? '尚無資料'}</strong><small>{topPage ? `${topPage.views.toLocaleString()} 次瀏覽` : '資料累積後顯示'}</small></article>
      <article><span>手機裝置占比</span><strong>{mobileShare}%</strong><small>{deviceTotal.toLocaleString()} 次裝置統計</small></article>
    </div>

    <div className="admin-traffic-kpis">
      <article><span>不重複 IP</span><strong>{analytics.uniqueVisitors.toLocaleString()}</strong><small>此期間的獨立訪客</small></article>
      <article><span>工作階段</span><strong>{analytics.sessions.toLocaleString()}</strong><small>每個瀏覽器分頁計為一次</small></article>
      <article><span>重複瀏覽</span><strong>{repeatViews.toLocaleString()}</strong><small>同一 IP 的第二次以後瀏覽</small></article>
      <article><span>回訪 IP</span><strong>{analytics.returningVisitors.toLocaleString()}</strong><small>在不同日期再次造訪</small></article>
      <article><span>每位訪客瀏覽</span><strong>{viewsPerVisitor}</strong><small>平均頁面數</small></article>
    </div>

    <div className="admin-traffic-grid">
      <section className="admin-traffic-card admin-traffic-chart-card">
        <div className="admin-traffic-card-heading"><div><h3>瀏覽趨勢</h3><p>每日頁面瀏覽次數</p></div><strong>{analytics.totalViews.toLocaleString()} <small>次</small></strong></div>
        {analytics.totalViews === 0 ? <div className="admin-chart-empty"><span>—</span><p>目前還沒有流量資料</p><small>新訪客開始瀏覽網站後，統計會從今天累積。</small></div>
          : <div className="admin-traffic-chart" role="img" aria-label={`${analytics.days} 天每日瀏覽趨勢`}>{analytics.daily.map((item, index) => <div className="admin-chart-column" key={item.day} title={`${item.day}：${item.views} 次`}>
            <span className="admin-chart-value">{item.views || ''}</span>
            <i style={{ height: `${Math.max(item.views ? 7 : 2, (item.views / maxDailyViews) * 100)}%` }} />
            <small>{analytics.days <= 7 || index % 5 === 0 || index === analytics.daily.length - 1 ? new Date(`${item.day}T00:00:00Z`).toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric', timeZone: 'UTC' }) : ''}</small>
          </div>)}</div>}
      </section>
      <section className="admin-traffic-card">
        <div className="admin-traffic-card-heading"><div><h3>裝置分布</h3><p>依瀏覽器提供的裝置類型分類</p></div></div>
        <div className="admin-device-list">{([{ key: 'desktop', label: '桌面裝置' }, { key: 'mobile', label: '手機' }, { key: 'tablet', label: '平板' }] as const).map(({ key, label }) => {
          const count = analytics.devices[key]
          const percent = deviceTotal ? Math.round(count / deviceTotal * 100) : 0
          return <div className="admin-device-row" key={key}><div><span>{label}</span><strong>{count.toLocaleString()} <small>{percent}%</small></strong></div><div className="admin-device-track"><i style={{ width: `${percent}%` }} /></div></div>
        })}</div>
      </section>
    </div>

    <section className="admin-traffic-card admin-traffic-chart-card">
      <div className="admin-traffic-card-heading"><div><h3>時段分布</h3><p>依你的當地時間統計每小時瀏覽次數</p></div><strong>{analytics.trackedViews.toLocaleString()} <small>次</small></strong></div>
      {analytics.trackedViews === 0 ? <p className="admin-traffic-no-pages">逐筆紀錄累積後顯示。</p>
        : <div className="admin-traffic-chart admin-hourly-chart" role="img" aria-label="每小時瀏覽分布">{localHours.map((views, hour) => <div className="admin-chart-column" key={hour} title={`${hour}:00–${hour}:59：${views} 次`}>
          <span className="admin-chart-value">{views || ''}</span>
          <i style={{ height: `${Math.max(views ? 7 : 2, (views / maxHourlyViews) * 100)}%` }} />
          <small>{hour % 3 === 0 ? hour : ''}</small>
        </div>)}</div>}
    </section>

    <section className="admin-traffic-card admin-ip-card">
      <div className="admin-traffic-card-heading"><div><h3>訪客 IP</h3><p>依瀏覽次數排序（前 50 筆），點擊 IP 可查看該訪客的每一筆瀏覽。</p></div><strong>{analytics.uniqueVisitors.toLocaleString()} <small>個 IP</small></strong></div>
      {analytics.topIps.length ? <div className="admin-table-scroll"><table className="admin-traffic-table">
        <thead><tr><th>IP</th><th>瀏覽</th><th>工作階段</th><th>造訪天數</th><th>地區</th><th>裝置</th><th>首次</th><th>最近</th></tr></thead>
        <tbody>{analytics.topIps.map((item) => <tr key={item.ip}>
          <td><button type="button" className="admin-ip-link" onClick={() => showIp(item.ip)}>{item.ip}</button></td>
          <td><strong>{item.views.toLocaleString()}</strong></td>
          <td>{item.sessions.toLocaleString()}</td>
          <td>{item.days.toLocaleString()}</td>
          <td>{formatLocation(item.country, item.region, item.city)}</td>
          <td>{deviceLabels[item.device] ?? item.device}<small>{item.browser} · {item.os}</small></td>
          <td className="admin-table-nowrap">{formatDateTime(item.firstSeen)}</td>
          <td className="admin-table-nowrap">{formatDateTime(item.lastSeen)}</td>
        </tr>)}</tbody>
      </table></div> : <p className="admin-traffic-no-pages">逐筆紀錄累積後，這裡會列出訪客 IP。</p>}
    </section>

    <VisitLog ipFilter={ipFilter} onIpFilter={setIpFilter} refresh={analyticsRefresh} onMessage={onMessage} />

    <section className="admin-traffic-card admin-source-card">
      <div className="admin-traffic-card-heading"><div><h3>進站來源</h3><p>每個瀏覽工作階段只計一次入口來源。</p></div><strong>{sourceTotal.toLocaleString()} <small>次進站</small></strong></div>
      <div className="admin-source-grid">{sourceLabels.map(({ key, label }) => {
        const count = analytics.sources[key]
        const percent = sourceTotal ? Math.round(count / sourceTotal * 100) : 0
        return <div key={key}><span>{label}</span><strong>{count.toLocaleString()} <small>{percent}%</small></strong><i><b style={{ width: `${percent}%` }} /></i></div>
      })}</div>
    </section>

    <div className="admin-traffic-split">
      <RankingCard title="來源網站" description="外部網站帶來的進站次數" items={analytics.referrers} empty="尚無外部來源紀錄。" />
      <RankingCard title="熱門路徑" description="依實際網址路徑統計" items={analytics.topPaths} empty="逐筆紀錄累積後顯示。" />
      <RankingCard title="瀏覽器" description="依 User-Agent 判斷" items={analytics.browsers} empty="逐筆紀錄累積後顯示。" />
      <RankingCard title="作業系統" description="依 User-Agent 判斷" items={analytics.operatingSystems} empty="逐筆紀錄累積後顯示。" />
    </div>

    <div className="admin-traffic-split">
      <LocationCard title="縣市／州省" description="依縣市（國外為州或省）統計瀏覽次數與 IP 數" items={analytics.regionLocations} detail="region" />
      <LocationCard title="鄉鎮市區／城市" description="台灣細分到鄉鎮市區，國外為城市" items={analytics.cityLocations} detail="city" />
    </div>

    <section className="admin-traffic-card admin-top-pages">
      <div className="admin-traffic-card-heading"><div><h3>文章成效</h3><p>訪客開啟文章後記錄，依瀏覽次數排序。</p></div></div>
      {analytics.topArticles.length ? <div className="admin-top-pages-list">{analytics.topArticles.map((item, index) => <div key={item.id}><span className="traffic-rank">{String(index + 1).padStart(2, '0')}</span><strong>{item.title}</strong><div className="admin-page-views-track"><i style={{ width: `${Math.max(4, item.views / analytics.topArticles[0].views * 100)}%` }} /></div><span>{item.views.toLocaleString()} <small>次</small></span></div>)}</div> : <p className="admin-traffic-no-pages">文章開啟後會開始累積成效資料。</p>}
    </section>

    <section className="admin-traffic-card admin-top-pages">
      <div className="admin-traffic-card-heading"><div><h3>熱門頁面</h3><p>依頁面瀏覽次數排序</p></div></div>
      {analytics.topPages.length ? <div className="admin-top-pages-list">{analytics.topPages.map((item, index) => <div key={item.page}><span className="traffic-rank">{String(index + 1).padStart(2, '0')}</span><strong>{item.label}</strong><div className="admin-page-views-track"><i style={{ width: `${Math.max(4, item.views / (topPage?.views || 1) * 100)}%` }} /></div><span>{item.views.toLocaleString()} <small>次</small></span></div>)}</div> : <p className="admin-traffic-no-pages">流量資料累積後，這裡會列出訪客最常瀏覽的頁面。</p>}
    </section>

    <p className="admin-analytics-note">總瀏覽量、趨勢、頁面、裝置、來源與地區來自每日彙總，保存 120 天。訪客 IP、時段、瀏覽器與瀏覽紀錄來自逐筆紀錄，保存 {analytics.eventRetentionDays} 天（可用 ANALYTICS_EVENT_RETENTION_DAYS 調整）{analytics.eventsSince ? `，自 ${new Date(analytics.eventsSince).toLocaleDateString('zh-TW')} 開始記錄` : ''}。IP 屬於個人資料，請在網站上告知訪客並妥善保管。地區由伺服器本機的 IP 定位資料庫判斷（IP Geolocation by DB-IP，CC BY 4.0），台灣再依內政部鄉鎮市區界線換算；IP 定位只是估計，行動網路與部分固網常只能定位到縣市甚至只有台北。若反向代理（TRUSTED_PROXY_IP）提供 CF-IPCountry／CF-IPCity／CF-IPLatitude 等標頭，會優先採用。</p>
  </section>
}

export default TrafficSection
