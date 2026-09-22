import type { Article, ArticleStats, SiteSettings } from './article'

async function request<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, { credentials: 'include', ...init })

  if (!response.ok) {
    const error = (await response.json().catch(() => ({ message: 'Request failed.' }))) as {
      message?: string
    }
    throw new Error(error.message ?? 'Request failed.')
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
