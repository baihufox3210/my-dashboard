import { useEffect, useState } from 'react'
import { fetchSiteSettings } from '../features/blog/api'

export function useSiteName() {
  const [siteName, setSiteName] = useState('Baihu Personal Website')
  useEffect(() => {
    let active = true
    fetchSiteSettings().then((settings) => { if (active && settings.siteName) setSiteName(settings.siteName) }).catch(() => undefined)
    return () => { active = false }
  }, [])
  return siteName
}

// Each page has its own tab and search-result title: "<page> | <site name>", or exactly
// `title` when `exact` is set (an author-chosen search title). Pass undefined to leave the
// title alone, for example while the server has already supplied the title of the project
// being opened.
function usePageTitle(title: string | undefined, exact = false) {
  const siteName = useSiteName()
  useEffect(() => {
    if (!title) return
    const previous = document.title
    document.title = exact ? title : `${title} | ${siteName}`
    return () => { document.title = previous }
  }, [title, exact, siteName])
}

export default usePageTitle
