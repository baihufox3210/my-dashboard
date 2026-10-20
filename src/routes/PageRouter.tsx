import { lazy, Suspense } from 'react'
import HomePage from '../pages/HomePage'
import { getPublicPage, isAdminRoute, isLoginRoute, useLocationKey } from './routes'

// Only the landing page ships in the main bundle; other pages load on first visit.
const AboutPage = lazy(() => import('../pages/AboutPage'))
const AdminPage = lazy(() => import('../pages/admin/AdminPage'))
const BlogPage = lazy(() => import('../pages/BlogPage'))
const FriendsPage = lazy(() => import('../pages/FriendsPage'))
const ProjectsPage = lazy(() => import('../pages/ProjectsPage'))

function currentPage() {
  if (isLoginRoute()) return 'login'
  if (isAdminRoute()) return 'admin'
  return getPublicPage()
}

function PageRouter() {
  useLocationKey()
  const page = currentPage()

  return (
    <Suspense fallback={null}>
      {page === 'admin' || page === 'login' ? <AdminPage loginOnly={page === 'login'} />
        : page === 'about' ? <AboutPage />
          : page === 'projects' ? <ProjectsPage />
            : page === 'blog' ? <BlogPage />
              : page === 'friends' ? <FriendsPage />
                : <HomePage />}
    </Suspense>
  )
}

export default PageRouter
