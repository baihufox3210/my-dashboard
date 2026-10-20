import type { ReactNode } from 'react'
import SiteHeader from '../components/SiteHeader'
import SiteFooter from '../components/SiteFooter'
import FloatingMusicPlayer from '../components/FloatingMusicPlayer'
import { getPublicPage, isAdminRoute, isLoginRoute, useLocationKey } from '../routes/routes'

type SiteLayoutProps = {
  children: ReactNode
}

function SiteLayout({ children }: SiteLayoutProps) {
  useLocationKey()
  const isAdmin = isAdminRoute() || isLoginRoute()
  const isHome = getPublicPage() === 'home'
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
