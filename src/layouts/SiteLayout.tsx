import { useEffect, useState, type ReactNode } from 'react'
import SiteHeader from '../components/SiteHeader'
import SiteFooter from '../components/SiteFooter'

type SiteLayoutProps = {
  children: ReactNode
}

function SiteLayout({ children }: SiteLayoutProps) {
  const [isAdmin, setIsAdmin] = useState(() => window.location.hash.slice(1).split('/')[0] === 'admin')
  useEffect(() => {
    const sync = () => setIsAdmin(window.location.hash.slice(1).split('/')[0] === 'admin')
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])
  return (
    <div className={`app-shell${isAdmin ? ' admin-shell-route' : ''}`}>
      {!isAdmin && <SiteHeader />}
      {children}
      {!isAdmin && <SiteFooter />}
    </div>
  )
}

export default SiteLayout
