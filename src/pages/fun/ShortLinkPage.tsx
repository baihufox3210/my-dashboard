import { lazy, useEffect, useState } from 'react'
import { fetchArticles, fetchProjects } from '../../features/blog/api'
import { keyFromCode, shortKey, type ShareKind } from '../../features/blog/shareLinks'
import { getPublicPath, getRouteSegments, navigate } from '../../routes/routes'

const NotFoundPage = lazy(() => import('./NotFoundPage'))

// Resolves /b/<code> and /p/<code> to the article or project and replaces the URL with
// its full address, so Back does not return to the short link.
function ShortLinkPage({ kind }: { kind: ShareKind }) {
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    let active = true
    const key = keyFromCode(getRouteSegments()[1] ?? '')
    const load: Promise<{ id: string }[]> = kind === 'b' ? fetchArticles() : fetchProjects()
    load.then((items) => {
      if (!active) return
      const matches = key ? items.filter((item) => shortKey(item.id) === key) : []
      const [match] = matches
      if (matches.length !== 1 || !match) { setMissing(true); return }
      const base = kind === 'b' ? `${getPublicPath('blog')}/post` : getPublicPath('projects')
      navigate(`${base}/${encodeURIComponent(match.id)}`, { replace: true })
    }).catch(() => { if (active) setMissing(true) })
    return () => { active = false }
  }, [kind])

  return missing ? <NotFoundPage /> : null
}

export default ShortLinkPage
