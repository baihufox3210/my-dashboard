import { useEffect, useRef, useState } from 'react'
import { terminalOpenEvent } from './FunLayer'
import { unlock } from '../features/fun/achievements'
import { showToast } from '../features/fun/memes'
import { fetchAdminSession, fetchSiteSettings } from '../features/blog/api'
import { getAdminPath, getPublicPath, type PublicPage } from '../routes/routes'

const navItems: { label: string; page: PublicPage }[] = [
  { label: 'Home', page: 'home' },
  { label: 'About', page: 'about' },
  { label: 'Projects', page: 'projects' },
  { label: 'Blog', page: 'blog' },
  { label: 'Friends', page: 'friends' },
]

function SiteHeader() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [siteName, setSiteName] = useState('Baihu Personal Website')
  const brandTaps = useRef({ count: 0, last: 0 })

  // Like Android's "build number": tap the site name seven times to become a developer.
  function tapBrand() {
    const now = Date.now()
    const taps = brandTaps.current
    taps.count = now - taps.last < 1500 ? taps.count + 1 : 1
    taps.last = now
    if (taps.count >= 7) {
      taps.count = 0
      unlock('developer')
      showToast('你現在是開發人員了！')
      window.dispatchEvent(new Event(terminalOpenEvent))
    } else if (taps.count >= 4) {
      showToast(`再點 ${7 - taps.count} 次即可成為開發人員`)
    }
  }

  useEffect(() => {
    fetchAdminSession()
      .then(({ authenticated }) => setIsAuthenticated(authenticated))
      .catch(() => setIsAuthenticated(false))
  }, [])

  useEffect(() => {
    fetchSiteSettings().then((settings) => setSiteName(settings.siteName)).catch(() => undefined)
  }, [])

  useEffect(() => {
    document.body.classList.toggle('menu-open', isMenuOpen)

    return () => document.body.classList.remove('menu-open')
  }, [isMenuOpen])

  return (
    <header className="topbar" aria-label="Top bar">
      <div className="brand-block" onClick={tapBrand}>{siteName}</div>

      <button
        type="button"
        className="menu-button"
        aria-label={isMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
        aria-expanded={isMenuOpen}
        onClick={() => setIsMenuOpen((isOpen) => !isOpen)}
      >
        <span />
        <span />
        <span />
      </button>

      <nav className={`nav ${isMenuOpen ? 'nav-open' : ''}`} aria-label="Main navigation">
        {navItems.map((item) => (
          <a
            key={item.page}
            href={getPublicPath(item.page)}
            className="nav-item"
            onClick={() => setIsMenuOpen(false)}
          >
            {item.label}
          </a>
        ))}
        {isAuthenticated && <a href={getAdminPath()} className="admin-nav-item" onClick={() => setIsMenuOpen(false)}>Admin</a>}
      </nav>
    </header>
  )
}

export default SiteHeader
