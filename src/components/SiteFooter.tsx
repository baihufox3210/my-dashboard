import { useEffect, useState } from 'react'
import { fetchVisitCounts } from '../features/blog/api'

function SiteFooter() {
  const [visits, setVisits] = useState<{ today: number; total: number } | null>(null)

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
      </p>
    </footer>
  )
}

export default SiteFooter
