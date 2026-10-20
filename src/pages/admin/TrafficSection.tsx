import { useEffect, useState } from 'react'
import { fetchAnalyticsStats } from '../../features/blog/api'
import type { AnalyticsStats } from '../../features/blog/article'

type SectionProps = { onMessage: (message: string) => void }

const blankAnalytics: AnalyticsStats = { days: 7, totalViews: 0, previousViews: 0, regionCount: 0, topRegions: [], daily: [], topPages: [], topArticles: [], sources: { direct: 0, search: 0, social: 0, referral: 0 }, devices: { mobile: 0, tablet: 0, desktop: 0 } }

function TrafficSection({ onMessage }: SectionProps) {
  const [analytics, setAnalytics] = useState(blankAnalytics)
  const [analyticsDays, setAnalyticsDays] = useState<7 | 30>(7)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [analyticsRefresh, setAnalyticsRefresh] = useState(0)

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
  const deviceTotal = analytics.devices.mobile + analytics.devices.tablet + analytics.devices.desktop
  const mobileShare = deviceTotal ? Math.round((analytics.devices.mobile / deviceTotal) * 100) : 0
  const topPage = analytics.topPages[0]
  const topRegion = analytics.topRegions[0]
  const changePercent = analytics.previousViews ? Math.round(((analytics.totalViews - analytics.previousViews) / analytics.previousViews) * 100) : null
  const sourceTotal = Object.values(analytics.sources).reduce((total, views) => total + views, 0)
  const sourceLabels = [{ key: 'search', label: '搜尋引擎' }, { key: 'social', label: '社群平台' }, { key: 'referral', label: '外部連結' }, { key: 'direct', label: '直接進站' }] as const

  return <section className="admin-traffic-page">
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
        </section>
}

export default TrafficSection
