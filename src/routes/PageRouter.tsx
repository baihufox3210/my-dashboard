import { lazy, Suspense } from 'react'
import HomePage from '../pages/HomePage'
import { getEasterEggPage, getPublicPage, isAdminRoute, isLoginRoute, useLocationKey } from './routes'

// Only the landing page ships in the main bundle; other pages load on first visit.
const AboutPage = lazy(() => import('../pages/AboutPage'))
const AdminPage = lazy(() => import('../pages/admin/AdminPage'))
const BlogPage = lazy(() => import('../pages/BlogPage'))
const FriendsPage = lazy(() => import('../pages/FriendsPage'))
const ProjectsPage = lazy(() => import('../pages/ProjectsPage'))
const ScamPanelPage = lazy(() => import('../pages/fun/ScamPanelPage'))
const HoneypotPage = lazy(() => import('../pages/fun/HoneypotPage'))

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

  return (
    <Suspense fallback={null}>
      {page === 'admin' || page === 'login' ? <AdminPage loginOnly={page === 'login'} />
        : page === 'panel' ? <ScamPanelPage />
        : page === 'honeypot' ? <HoneypotPage />
        : page === 'about' ? <AboutPage />
          : page === 'projects' ? <ProjectsPage />
            : page === 'blog' ? <BlogPage />
              : page === 'friends' ? <FriendsPage />
                : <HomePage />}
    </Suspense>
  )
}

export default PageRouter
