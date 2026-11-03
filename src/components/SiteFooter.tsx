import { useEffect, useState } from 'react'
import { terminalOpenEvent } from './FunLayer'
import { analyticsSessionId, fetchVisitCounts, sendPresence } from '../features/blog/api'

// Heartbeat every 30 seconds while the tab is visible; returns how many tabs are online.
function useOnlineCount() {
  const [online, setOnline] = useState<number | null>(null)
  useEffect(() => {
    const sessionId = analyticsSessionId()
    if (!sessionId) return
    let active = true
    const beat = () => {
      if (document.visibilityState !== 'visible') return
      sendPresence(sessionId).then(({ online: count }) => { if (active) setOnline(count) }).catch(() => undefined)
    }
    beat()
    const timer = window.setInterval(beat, 30_000)
    document.addEventListener('visibilitychange', beat)
    return () => { active = false; window.clearInterval(timer); document.removeEventListener('visibilitychange', beat) }
  }, [])
  return online
}

function SiteFooter() {
  const [visits, setVisits] = useState<{ today: number; total: number } | null>(null)
  const online = useOnlineCount()

  useEffect(() => {
    let active = true
    // Read after this page's own view has had a moment to be recorded.
    const timer = window.setTimeout(() => {
      fetchVisitCounts().then((counts) => { if (active) setVisits(counts) }).catch(() => undefined)
    }, 600)
    return () => { active = false; window.clearTimeout(timer) }
  }, [])

  return (
    <footer className="footer">
      <p className="footer-text">
        Copyright © {new Date().getFullYear()} Baihu Personal Website. All Rights Reserved.
        {visits && <span className="footer-visits"> · 今日 {visits.today.toLocaleString()} 次 · 累計 {visits.total.toLocaleString()} 次瀏覽</span>}
        {online !== null && <span className="footer-online"> · <i aria-hidden="true" />{online} 人在線</span>}
        <button type="button" className="footer-terminal" onClick={() => window.dispatchEvent(new Event(terminalOpenEvent))} aria-label="開啟終端機" title="終端機（按 ` 或 Ctrl+K）">&gt;_</button>
      </p>
    </footer>
  )
}

export default SiteFooter
