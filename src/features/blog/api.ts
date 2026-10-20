import type { AnalyticsStats, Article, ArticleStats, ArticleSummary, Friend, HomeProfile, MusicTrack, Project, ServerStatus, SiteSettings } from './article'

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

// Shared GET cache: concurrent callers share one request and repeat reads within
// `maxAgeMs` reuse it. Mutations below invalidate the keys they affect.
const cacheMaxAgeMs = 30_000
const responseCache = new Map<string, { at: number; value: Promise<unknown> }>()

function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const entry = responseCache.get(key)
  if (entry && Date.now() - entry.at < cacheMaxAgeMs) return entry.value as Promise<T>
  const value = load()
  responseCache.set(key, { at: Date.now(), value })
  value.catch(() => { if (responseCache.get(key)?.value === value) responseCache.delete(key) })
  return value
}

function invalidate(...keys: string[]) {
  for (const key of keys) responseCache.delete(key)
}

async function mutate<T>(promise: Promise<T>, ...keys: string[]) {
  const result = await promise
  invalidate(...keys)
  return result
}

export function fetchArticles() {
  return cached('articles', () => request<ArticleSummary[]>('/api/articles', { cache: 'no-store' }))
}

const articleCache = new Map<string, Promise<Article>>()

// Full articles are cached per revision, so reopening an unchanged article is instant.
export function fetchArticle(summary: Pick<ArticleSummary, 'id' | 'publishedAt' | 'updatedAt'>) {
  const key = `${summary.id}:${summary.updatedAt ?? summary.publishedAt}`
  let article = articleCache.get(key)
  if (!article) {
    article = request<Article>(`/api/articles/${encodeURIComponent(summary.id)}`, { cache: 'no-store' })
    article.catch(() => articleCache.delete(key))
    articleCache.set(key, article)
  }
  return article
}

export function fetchArticleStats() {
  return cached('stats', () => request<ArticleStats>('/api/stats'))
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
  return cached('session', () => request<{ authenticated: boolean }>('/api/auth/me'))
}

export function loginAdmin(username: string, password: string) {
  return mutate(request<{ authenticated: boolean; challenge?: { flag: string } }>('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  }), 'session')
}

export function logoutAdmin() {
  return mutate(request<{ authenticated: boolean }>('/api/auth/logout', { method: 'POST' }), 'session')
}

type SavedArticle = Article & ArticleSummary

export function publishArticle(formData: FormData) {
  return mutate(request<SavedArticle>('/api/articles', { method: 'POST', body: formData }), 'articles', 'stats')
}

export function updateArticle(id: string, formData: FormData) {
  return mutate(request<SavedArticle>(`/api/articles/${encodeURIComponent(id)}`, { method: 'PUT', body: formData }), 'articles', 'stats')
}


export function deleteArticle(id: string) {
  return mutate(request<void>(`/api/articles/${encodeURIComponent(id)}`, { method: 'DELETE' }), 'articles', 'stats')
}

export function fetchSiteSettings() {
  return cached('site-settings', () => request<SiteSettings>('/api/site-settings'))
}

export function updateSiteSettings(formData: FormData) {
  return mutate(request<SiteSettings>('/api/admin/site-settings', { method: 'PUT', body: formData }), 'site-settings')
}

export function fetchHomeProfile() {
  return cached('home-profile', () => request<HomeProfile>('/api/home-profile'))
}

export function updateHomeProfile(formData: FormData) {
  return mutate(request<HomeProfile>('/api/admin/home-profile', { method: 'PUT', body: formData }), 'home-profile')
}

export function fetchFriends() {
  return cached('friends', () => request<Friend[]>('/api/friends'))
}

export function createFriend(formData: FormData) {
  return mutate(request<Friend>('/api/admin/friends', { method: 'POST', body: formData }), 'friends')
}

export function updateFriend(id: string, formData: FormData) {
  return mutate(request<Friend>(`/api/admin/friends/${encodeURIComponent(id)}`, { method: 'PUT', body: formData }), 'friends')
}

export function deleteFriend(id: string) {
  return mutate(request<void>(`/api/admin/friends/${encodeURIComponent(id)}`, { method: 'DELETE' }), 'friends')
}

export function fetchProjects() {
  return cached('projects', () => request<Project[]>('/api/projects', { cache: 'no-store' }))
}

export function createProject(formData: FormData) {
  return mutate(request<Project>('/api/admin/projects', { method: 'POST', body: formData }), 'projects')
}

export function updateProject(id: string, formData: FormData) {
  return mutate(request<Project>(`/api/admin/projects/${encodeURIComponent(id)}`, { method: 'PUT', body: formData }), 'projects')
}

export function deleteProject(id: string) {
  return mutate(request<void>(`/api/admin/projects/${encodeURIComponent(id)}`, { method: 'DELETE' }), 'projects')
}

export function fetchServerStatus() {
  return request<ServerStatus>('/api/server-status', { cache: 'no-store' })
}

export function fetchMusicTracks() {
  return cached('music', () => request<MusicTrack[]>('/api/music', { cache: 'no-store' }))
}

export function uploadMusicTracks(formData: FormData) {
  return mutate(request<MusicTrack[]>('/api/admin/music', { method: 'POST', body: formData }), 'music')
}

export function updateMusicTrackOrder(ids: string[]) {
  return mutate(request<MusicTrack[]>('/api/admin/music/order', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  }), 'music')
}

export function deleteMusicTrack(id: string) {
  return mutate(request<void>(`/api/admin/music/${encodeURIComponent(id)}`, { method: 'DELETE' }), 'music')
}
