import type { ReactNode } from 'react'
import SiteHeader from '../components/SiteHeader'
import SiteFooter from '../components/SiteFooter'

type SiteLayoutProps = {
  children: ReactNode
}

function SiteLayout({ children }: SiteLayoutProps) {
  return (
    <div className="app-shell">
      <SiteHeader />
      {children}
      <SiteFooter />
    </div>
  )
}

export default SiteLayout