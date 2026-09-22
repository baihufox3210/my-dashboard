export type Article = {
  id: string
  title: string
  content: string
  category: string
  tags: string[]
  coverImage?: string
  publishedAt: string
}

export type ArticleStats = {
  articleCount: number
  categoryCount: number
  tagCount: number
  totalWords: number
  runtimeDays: number
  lastActivity: string | null
}

export type SiteSettings = {
  siteName: string
  biography: string
  experience: string
  avatarUrl?: string
  backgroundUrl?: string
}
