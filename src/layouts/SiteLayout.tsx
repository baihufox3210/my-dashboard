import type { ReactNode } from 'react'
import SiteHeader from '../components/SiteHeader'
import SiteFooter from '../components/SiteFooter'
import FloatingMusicPlayer from '../components/FloatingMusicPlayer'
import FunLayer from '../components/FunLayer'
import { getEasterEggPage, getPublicPage, isAdminRoute, isLoginRoute, useLocationKey } from '../routes/routes'

type SiteLayoutProps = {
  children: ReactNode
}

function SiteLayout({ children }: SiteLayoutProps) {
  useLocationKey()
  const isAdmin = isAdminRoute() || isLoginRoute()
  // The parody scam panel is a full-screen page of its own: no site chrome, but easter eggs stay on.
  const hideChrome = isAdmin || getEasterEggPage() === 'panel'
  const isHome = getPublicPage() === 'home'
  return (
    <div className={`app-shell${isAdmin ? ' admin-shell-route' : ''}`}>
      {!hideChrome && <SiteHeader />}
      {children}
      {!hideChrome && <FloatingMusicPlayer isHome={isHome} />}
      {!hideChrome && <SiteFooter />}
      {!isAdmin && <FunLayer />}
    </div>
  )
}

export default SiteLayout
