import { useEffect, useState } from 'react'
import { fetchSiteSettings } from '../features/blog/api'

// Each page has its own tab and search-result title: "<page> | <site name>". Pass undefined
// to leave the title alone, for example while the server has already supplied the title of
// the article or project being opened.
function usePageTitle(title: string | undefined) {
  const [siteName, setSiteName] = useState('Baihu Personal Website')
  useEffect(() => {
    let active = true
    fetchSiteSettings().then((settings) => { if (active && settings.siteName) setSiteName(settings.siteName) }).catch(() => undefined)
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!title) return
    const previous = document.title
    document.title = `${title} | ${siteName}`
    return () => { document.title = previous }
  }, [title, siteName])
}

export default usePageTitle
