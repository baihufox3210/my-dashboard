import type { AnalyticsStats, Article, ArticleStats, Friend, HomeProfile, MusicTrack, Project, ServerStatus, SiteSettings } from './article'

async function request<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, { credentials: 'include', ...init })

  if (!response.ok) {
    const isJson = response.headers.get('content-type')?.includes('application/json') ?? false
    const error = isJson
      ? (await response.json().catch(() => ({}))) as { message?: string }
      : {}
    const fallbackMessage = response.status === 413
      ? '上傳檔案過大。圖片請限制在 8 MB、PDF 請限制在 25 MB 以內。'
      : `Request failed (${response.status}).`
    throw new Error(error.message ?? fallbackMessage)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}

export function fetchArticles() {
  return request<Article[]>('/api/articles', { cache: 'no-store' })
}

export function fetchArticleStats() {
  return request<ArticleStats>('/api/stats')
}


export async function fetchAnalyticsStats(days: 7 | 30): Promise<AnalyticsStats> {
  const stats = await request<Partial<AnalyticsStats>>(`/api/admin/analytics?days=${days}`)
  return {
    days: stats.days ?? days,
    totalViews: stats.totalViews ?? 0,
    previousViews: stats.previousViews ?? 0,
    regionCount: stats.regionCount ?? 0,
    topRegions: stats.topRegions ?? [],
    daily: stats.daily ?? [],
    topPages: stats.topPages ?? [],
    topArticles: stats.topArticles ?? [],
    sources: stats.sources ?? { direct: 0, search: 0, social: 0, referral: 0 },
    devices: stats.devices ?? { mobile: 0, tablet: 0, desktop: 0 },
  }
}

export type AnalyticsPage = 'home' | 'about' | 'projects' | 'blog' | 'article' | 'contact' | 'friends'
export type AnalyticsSource = 'direct' | 'search' | 'social' | 'referral'

export function recordPageView(page: AnalyticsPage, options: { articleId?: string; source?: AnalyticsSource } = {}) {
  return fetch('/api/analytics/view', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ page, ...options }),
    keepalive: true,
  }).catch(() => undefined)
}

export type AdminActivity = { at: string; type: 'article' | 'homepage' | 'site'; action: 'published' | 'updated' | 'deleted' | 'saved'; title: string }

export function fetchAdminActivity() {
  return request<AdminActivity[]>('/api/admin/activity')
}

export function fetchAdminSession() {
  return request<{ authenticated: boolean }>('/api/auth/me')
}

export function loginAdmin(username: string, password: string) {
  return request<{ authenticated: boolean; challenge?: { flag: string } }>('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
}

export function logoutAdmin() {
  return request<{ authenticated: boolean }>('/api/auth/logout', { method: 'POST' })
}

export function publishArticle(formData: FormData) {
  return request<Article>('/api/articles', { method: 'POST', body: formData })
}

export function updateArticle(id: string, formData: FormData) {
  return request<Article>(`/api/articles/${id}`, { method: 'PUT', body: formData })
}


export function deleteArticle(id: string) {
  return request<void>(`/api/articles/${id}`, { method: 'DELETE' })
}

export function fetchSiteSettings() {
  return request<SiteSettings>('/api/site-settings')
}

export function updateSiteSettings(formData: FormData) {
  return request<SiteSettings>('/api/admin/site-settings', { method: 'PUT', body: formData })
}

export function fetchHomeProfile() {
  return request<HomeProfile>('/api/home-profile')
}

export function updateHomeProfile(formData: FormData) {
  return request<HomeProfile>('/api/admin/home-profile', { method: 'PUT', body: formData })
}

export function fetchFriends() {
  return request<Friend[]>('/api/friends')
}

export function createFriend(formData: FormData) {
  return request<Friend>('/api/admin/friends', { method: 'POST', body: formData })
}

export function updateFriend(id: string, formData: FormData) {
  return request<Friend>(`/api/admin/friends/${encodeURIComponent(id)}`, { method: 'PUT', body: formData })
}

export function deleteFriend(id: string) {
  return request<void>(`/api/admin/friends/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export function fetchProjects() {
  return request<Project[]>('/api/projects', { cache: 'no-store' })
}

export function createProject(formData: FormData) {
  return request<Project>('/api/admin/projects', { method: 'POST', body: formData })
}

export function updateProject(id: string, formData: FormData) {
  return request<Project>(`/api/admin/projects/${encodeURIComponent(id)}`, { method: 'PUT', body: formData })
}

export function deleteProject(id: string) {
  return request<void>(`/api/admin/projects/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export function fetchServerStatus() {
  return request<ServerStatus>('/api/server-status', { cache: 'no-store' })
}

export function fetchMusicTracks() {
  return request<MusicTrack[]>('/api/music', { cache: 'no-store' })
}

export function uploadMusicTracks(formData: FormData) {
  return request<MusicTrack[]>('/api/admin/music', { method: 'POST', body: formData })
}

export function updateMusicTrackOrder(ids: string[]) {
  return request<MusicTrack[]>('/api/admin/music/order', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  })
}

export function deleteMusicTrack(id: string) {
  return request<void>(`/api/admin/music/${encodeURIComponent(id)}`, { method: 'DELETE' })
}
