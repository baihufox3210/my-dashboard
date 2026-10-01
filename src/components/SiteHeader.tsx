import { useEffect, useState } from 'react'
import { fetchAdminSession, fetchSiteSettings } from '../features/blog/api'

const navItems = ['Home', 'About', 'Projects', 'Blog', 'Friends']

function SiteHeader() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [siteName, setSiteName] = useState('Baihu Personal Website')

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
      <div className="brand-block">{siteName}</div>

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
            key={item}
            href={`#${item.toLowerCase()}`}
            className="nav-item"
            onClick={() => setIsMenuOpen(false)}
          >
            {item}
          </a>
        ))}
        {isAuthenticated && <a href="#admin" className="admin-nav-item" onClick={() => setIsMenuOpen(false)}>Admin</a>}
      </nav>
    </header>
  )
}

export default SiteHeader
