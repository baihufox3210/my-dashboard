export type PublicPage = 'home' | 'about' | 'projects' | 'blog' | 'friends'
export type AdminSection = 'overview' | 'home' | 'site' | 'traffic' | 'friends' | 'projects' | 'music'

const publicPages = new Set<PublicPage>(['home', 'about', 'projects', 'blog', 'friends'])
const adminSections = new Set<AdminSection>(['overview', 'home', 'site', 'traffic', 'friends', 'projects', 'music'])

function cleanSegment(value: string) {
  return value.trim().toLowerCase()
}

export function getRouteSegments() {
  const pathnameSegments = window.location.pathname.split('/').filter(Boolean).map(cleanSegment)
  if (pathnameSegments.length > 0) return pathnameSegments

  // Keep old hash links working while all newly generated links use pathname routes.
  return window.location.hash.slice(1).split('/').filter(Boolean).map(cleanSegment)
}

export function getPublicPage(): PublicPage {
  const firstSegment = getRouteSegments()[0]
  if (firstSegment && publicPages.has(firstSegment as PublicPage)) return firstSegment as PublicPage
  return 'home'
}

export function isLoginRoute() {
  return getRouteSegments()[0] === 'login'
}

export function isAdminRoute() {
  return getRouteSegments()[0] === 'admin'
}

export function getAdminSection(): AdminSection {
  const [firstSegment, secondSegment] = getRouteSegments()
  if (firstSegment !== 'admin') return 'overview'
  if (secondSegment && adminSections.has(secondSegment as AdminSection)) return secondSegment as AdminSection
  return 'overview'
}

export function getPublicPath(page: PublicPage) {
  return page === 'home' ? '/' : `/${page}`
}

export function getAdminPath(section: AdminSection = 'overview') {
  return section === 'overview' ? '/admin' : `/admin/${section}`
}
