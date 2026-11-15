import { lazy, Suspense } from 'react'
import HomePage from '../pages/HomePage'
import { getEasterEggPage, getPublicPage, getShortLinkKind, isAdminRoute, isLoginRoute, useLocationKey } from './routes'

// Only the landing page ships in the main bundle; other pages load on first visit.
const AboutPage = lazy(() => import('../pages/AboutPage'))
const AdminPage = lazy(() => import('../pages/admin/AdminPage'))
const BlogPage = lazy(() => import('../pages/BlogPage'))
const FriendsPage = lazy(() => import('../pages/FriendsPage'))
const ProjectsPage = lazy(() => import('../pages/ProjectsPage'))
const ScamPanelPage = lazy(() => import('../pages/fun/ScamPanelPage'))
const HoneypotPage = lazy(() => import('../pages/fun/HoneypotPage'))
const NotFoundPage = lazy(() => import('../pages/fun/NotFoundPage'))
const CertificatePage = lazy(() => import('../pages/fun/CertificatePage'))
const ShortLinkPage = lazy(() => import('../pages/fun/ShortLinkPage'))

function currentPage() {
  if (isLoginRoute()) return 'login'
  if (isAdminRoute()) return 'admin'
  const easterEgg = getEasterEggPage()
  if (easterEgg) return easterEgg
  return getPublicPage()
}

function PageRouter() {
  useLocationKey()
  const page = currentPage()
  const shortLink = getShortLinkKind()

  return (
    <Suspense fallback={null}>
      {shortLink ? <ShortLinkPage key={shortLink} kind={shortLink} />
        : page === 'admin' || page === 'login' ? <AdminPage loginOnly={page === 'login'} />
        : page === 'panel' ? <ScamPanelPage />
        : page === 'honeypot' ? <HoneypotPage />
        : page === 'notfound' ? <NotFoundPage />
        : page === 'certificate' ? <CertificatePage />
        : page === 'about' ? <AboutPage />
          : page === 'projects' ? <ProjectsPage />
            : page === 'blog' ? <BlogPage />
              : page === 'friends' ? <FriendsPage />
                : <HomePage />}
    </Suspense>
  )
}

export default PageRouter
