import { useEffect, useRef } from 'react'
import './App.css'
import { fetchSiteSettings, recordPageView } from './features/blog/api'
import type { AnalyticsPage } from './features/blog/api'
import { applySiteBackground } from './features/blog/background'
import SiteLayout from './layouts/SiteLayout'
import PageRouter from './routes/PageRouter'

function App() {
  const lastTrackedPage = useRef('')
  useEffect(() => {
    fetchSiteSettings()
      .then(applySiteBackground)
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    const trackPage = () => {
      const parts = window.location.hash.slice(1).toLowerCase().split('/')
      const route = parts[0] || 'home'
      if (route === 'admin' || (route === 'blog' && ['new', 'edit'].includes(parts[1] ?? ''))) return
      const trackedPages: AnalyticsPage[] = ['home', 'about', 'projects', 'blog', 'contact', 'friends']
      const page: AnalyticsPage = trackedPages.includes(route as AnalyticsPage) ? route as AnalyticsPage : 'home'
      if (lastTrackedPage.current === page) return
      lastTrackedPage.current = page
      let source: 'direct' | 'search' | 'social' | 'referral' | undefined
      try {
        const now = Date.now()
        const lastEntry = Number(sessionStorage.getItem('analytics-entry-at') ?? 0)
        if (!lastEntry || now - lastEntry >= 30 * 60 * 1000) {
          sessionStorage.setItem('analytics-entry-at', String(now))
          const referrer = document.referrer
          if (!referrer) source = 'direct'
          else {
            const host = new URL(referrer).hostname.toLowerCase()
            if (/google\.|bing\.|yahoo\.|duckduckgo\.|baidu\.|ecosia\.|yandex\./.test(host)) source = 'search'
            else if (/facebook\.|instagram\.|threads\.|x\.com$|twitter\.|t\.co$|youtube\.|reddit\.|discord\.|tiktok\.|linkedin\./.test(host)) source = 'social'
            else if (new URL(referrer).origin !== window.location.origin) source = 'referral'
            else source = 'direct'
          }
        }
      } catch { source = 'direct' }
      void recordPageView(page, source ? { source } : {})
    }
    trackPage()
    window.addEventListener('hashchange', trackPage)
    return () => window.removeEventListener('hashchange', trackPage)
  }, [])

  return (
    <SiteLayout>
      <PageRouter />
    </SiteLayout>
  )
}

export default App
