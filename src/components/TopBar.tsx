import { useEffect, useState } from 'react'

const navItems = ['Home', 'About', 'Projects', 'Blog', 'Contact', 'Friends']

function TopBar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  useEffect(() => {
    document.body.classList.toggle('menu-open', isMenuOpen)

    return () => document.body.classList.remove('menu-open')
  }, [isMenuOpen])

  return (
    <header className="topbar" aria-label="Top bar">
      <div className="brand-block">Baihu Personal Website</div>

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
            href="#"
            className="nav-item"
            onClick={() => setIsMenuOpen(false)}
          >
            {item}
          </a>
        ))}
      </nav>
    </header>
  )
}

export default TopBar
