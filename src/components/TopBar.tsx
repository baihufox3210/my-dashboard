const navItems = ['Home', 'About', 'Projects', 'Blog', 'Contact', 'Friends']

function TopBar() {
  return (
    <header className="topbar" aria-label="Top bar">
      <div className="brand-block">Baihu Personal Website</div>

      <nav className="nav" aria-label="Main navigation">
        {navItems.map((item) => (
          <a key={item} href="#" className="nav-item">
            {item}
          </a>
        ))}
      </nav>
    </header>
  )
}

export default TopBar
