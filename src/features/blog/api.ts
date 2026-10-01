import type { AnalyticsStats, Article, ArticleStats, Friend, HomeProfile, Project, SiteSettings } from './article'

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
  return request<Article[]>('/api/articles')
}

export function fetchArticleStats() {
  return request<ArticleStats>('/api/stats')
}

export function fetchAnalyticsStats(days: 7 | 30) {
  return request<AnalyticsStats>(`/api/admin/analytics?days=${days}`)
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
  return request<{ authenticated: boolean }>('/api/auth/login', {
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
  return request<Project[]>('/api/projects')
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
