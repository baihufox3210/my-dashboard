export type Article = {
  id: string
  title: string
  content: string
  category: string
  tags: string[]
  coverImage?: string
  coverImagePosition?: string
  coverImageScale?: number
  publishedAt: string
  updatedAt?: string
}

export type ArticleStats = {
  articleCount: number
  categoryCount: number
  tagCount: number
  totalWords: number
  runtimeDays: number
  lastActivity: string | null
}

export type AnalyticsStats = {
  days: number
  totalViews: number
  previousViews: number
  daily: { day: string; views: number }[]
  topPages: { page: string; label: string; views: number }[]
  topArticles: { id: string; title: string; views: number }[]
  sources: { direct: number; search: number; social: number; referral: number }
  devices: { mobile: number; tablet: number; desktop: number }
}

export type SiteSettings = {
  siteName: string
  biography: string
  experience: string
  avatarUrl?: string
  backgroundUrl?: string
  backgroundPositionX?: number
  backgroundPositionY?: number
}

export type HomeProfile = {
  name: string
  introduction: string
  quote: string
  avatarUrl?: string
  socials: { name: string; url: string }[]
  tags: string[]
  avatarMessages: string[]
  updateTitle: string
  updateText: string
}

export type Friend = {
  id: string
  name: string
  introduction: string
  url: string
  avatarUrl?: string
}

export type Project = {
  id: string
  title: string
  summary: string
  description: string
  category: string
  tags: string[]
  projectUrl: string
  coverImage?: string
  documentUrl?: string
  publishedAt: string
  updatedAt?: string
}
