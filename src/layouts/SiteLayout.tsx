import { useEffect, useState, type ReactNode } from 'react'
import SiteHeader from '../components/SiteHeader'
import SiteFooter from '../components/SiteFooter'
import FloatingMusicPlayer from '../components/FloatingMusicPlayer'
import { getPublicPage, isAdminRoute, isLoginRoute } from '../routes/routes'

type SiteLayoutProps = {
  children: ReactNode
}

function isAdminLocation() {
  return isAdminRoute() || isLoginRoute()
}

function SiteLayout({ children }: SiteLayoutProps) {
  const [isAdmin, setIsAdmin] = useState(isAdminLocation)
  const [isHome, setIsHome] = useState(() => getPublicPage() === 'home')
  useEffect(() => {
    const sync = () => {
      setIsAdmin(isAdminLocation())
      setIsHome(getPublicPage() === 'home')
    }
    window.addEventListener('popstate', sync)
    window.addEventListener('hashchange', sync)
    return () => {
      window.removeEventListener('popstate', sync)
      window.removeEventListener('hashchange', sync)
    }
  }, [])
  return (
    <div className={`app-shell${isAdmin ? ' admin-shell-route' : ''}`}>
      {!isAdmin && <SiteHeader />}
      {children}
      {!isAdmin && <FloatingMusicPlayer isHome={isHome} />}
      {!isAdmin && <SiteFooter />}
    </div>
  )
}

export default SiteLayout
