import { useEffect, useState } from 'react'
import AboutPage from '../pages/AboutPage'
import AdminPage from '../pages/AdminPage'
import BlogPage from '../pages/BlogPage'
import ContactPage from '../pages/ContactPage'
import FriendsPage from '../pages/FriendsPage'
import HomePage from '../pages/HomePage'
import ProjectsPage from '../pages/ProjectsPage'

function getCurrentPage() {
  return window.location.hash.slice(1).toLowerCase().split('/')[0] || 'home'
}

function PageRouter() {
  const [currentPage, setCurrentPage] = useState(getCurrentPage)

  useEffect(() => {
    const handleHashChange = () => setCurrentPage(getCurrentPage())

    window.addEventListener('hashchange', handleHashChange)

    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  switch (currentPage) {
    case 'admin':
      return <AdminPage />
    case 'about':
      return <AboutPage />
    case 'projects':
      return <ProjectsPage />
    case 'blog':
      return <BlogPage />
    case 'contact':
      return <ContactPage />
    case 'friends':
      return <FriendsPage />
    default:
      return <HomePage />
  }
}

export default PageRouter