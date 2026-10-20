import { lazy, Suspense, useEffect, useState } from 'react'
import AboutPage from '../pages/AboutPage'
import BlogPage from '../pages/BlogPage'
import FriendsPage from '../pages/FriendsPage'
import HomePage from '../pages/HomePage'
import ProjectsPage from '../pages/ProjectsPage'
import { getPublicPage, isAdminRoute, isLoginRoute } from './routes'

const AdminPage = lazy(() => import('../pages/AdminPage'))

function getCurrentPage() {
  if (isLoginRoute()) return 'login'
  if (isAdminRoute()) return 'admin'
  return getPublicPage()
}

function PageRouter() {
  const [currentPage, setCurrentPage] = useState(getCurrentPage)

  useEffect(() => {
    const handleRouteChange = () => setCurrentPage(getCurrentPage())

    window.addEventListener('popstate', handleRouteChange)
    window.addEventListener('hashchange', handleRouteChange)

    return () => {
      window.removeEventListener('popstate', handleRouteChange)
      window.removeEventListener('hashchange', handleRouteChange)
    }
  }, [])

  switch (currentPage) {
    case 'admin':
    case 'login':
      return <Suspense fallback={null}><AdminPage loginOnly={currentPage === 'login'} /></Suspense>
    case 'about':
      return <AboutPage />
    case 'projects':
      return <ProjectsPage />
    case 'blog':
      return <BlogPage />
    case 'friends':
      return <FriendsPage />
    default:
      return <HomePage />
  }
}

export default PageRouter
