import { useEffect, useRef, useState } from 'react'
import './App.css'
import './theme.css'
import { fetchSiteSettings, recordPageView } from './features/blog/api'
import type { AnalyticsPage } from './features/blog/api'
import { applySiteBackground } from './features/blog/background'
import MusicPlayerProvider from './components/MusicPlayerContext'
import SiteLayout from './layouts/SiteLayout'
import PageRouter from './routes/PageRouter'
import { getRouteSegments, isAdminRoute, isLoginRoute } from './routes/routes'

function App() {
  const lastTrackedPage = useRef('')
  const [backgroundReady, setBackgroundReady] = useState(false)
  useEffect(() => {
    let settings: Awaited<ReturnType<typeof fetchSiteSettings>> | null = null
    let active = true
    document.body.classList.add('site-background-loading')
    const syncBackground = () => {
      if (settings) void applySiteBackground(settings, false)
    }
    const reveal = () => {
      if (!active) return
      document.body.classList.remove('site-background-loading')
      setBackgroundReady(true)
    }
    fetchSiteSettings()
      .then(async (loaded) => {
        settings = loaded
        await applySiteBackground(loaded)
        reveal()
      })
      .catch(() => reveal())
    window.addEventListener('resize', syncBackground)
    return () => {
      active = false
      document.body.classList.remove('site-background-loading')
      window.removeEventListener('resize', syncBackground)
    }
  }, [])

  useEffect(() => {
    const handleInternalNavigation = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const target = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null
      if (!target || target.target === '_blank' || target.hasAttribute('download')) return
      const url = new URL(target.href, window.location.href)
      if (url.origin !== window.location.origin || !['http:', 'https:'].includes(url.protocol)) return
      if (url.pathname === window.location.pathname && url.search === window.location.search && url.hash === window.location.hash) return
      event.preventDefault()
      window.history.pushState({}, '', `${url.pathname}${url.search}${url.hash}`)
      window.dispatchEvent(new PopStateEvent('popstate'))
    }
    document.addEventListener('click', handleInternalNavigation)
    return () => document.removeEventListener('click', handleInternalNavigation)
  }, [])

  useEffect(() => {
    const trackPage = () => {
      const parts = getRouteSegments()
      const route = parts[0] ?? 'home'
      if (isAdminRoute() || isLoginRoute() || (route === 'blog' && ['new', 'edit'].includes(parts[1] ?? ''))) return
      const trackedPages: AnalyticsPage[] = ['home', 'about', 'projects', 'blog', 'friends']
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
    window.addEventListener('popstate', trackPage)
    window.addEventListener('hashchange', trackPage)
    return () => {
      window.removeEventListener('popstate', trackPage)
      window.removeEventListener('hashchange', trackPage)
    }
  }, [])

  if (!backgroundReady) return null

  return (
    <MusicPlayerProvider>
      <SiteLayout>
        <PageRouter />
      </SiteLayout>
    </MusicPlayerProvider>
  )
}

export default App
