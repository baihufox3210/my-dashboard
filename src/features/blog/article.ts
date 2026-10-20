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

// Article list entries omit the Markdown body; load it with fetchArticle when needed.
export type ArticleSummary = Omit<Article, 'content'> & {
  excerpt: string
  wordCount: number
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
  regionCount: number
  topRegions: { country: string; region: string; views: number }[]
  daily: { day: string; views: number }[]
  topPages: { page: string; label: string; views: number }[]
  topArticles: { id: string; title: string; views: number }[]
  sources: { direct: number; search: number; social: number; referral: number }
  devices: { mobile: number; tablet: number; desktop: number }
  trackedViews: number
  uniqueVisitors: number
  sessions: number
  returningVisitors: number
  hourlyUtc: number[]
  browsers: AnalyticsCount[]
  operatingSystems: AnalyticsCount[]
  referrers: AnalyticsCount[]
  topPaths: AnalyticsCount[]
  topIps: AnalyticsIp[]
  regionLocations: AnalyticsLocation[]
  cityLocations: AnalyticsLocation[]
  eventsSince: string | null
  eventRetentionDays: number
}

export type AnalyticsCount = { key: string; views: number }

export type AnalyticsLocation = { country: string; region: string; city?: string; views: number; visitors: number }

export type AnalyticsIp = {
  ip: string
  views: number
  sessions: number
  days: number
  firstSeen: string
  lastSeen: string
  country: string
  region: string
  city: string
  device: string
  browser: string
  os: string
}

export type AnalyticsVisit = {
  id: number
  at: string
  ip: string
  sessionId: string
  page: string
  path: string
  articleId: string
  articleTitle: string
  source: string
  referrer: string
  device: string
  browser: string
  os: string
  country: string
  region: string
  city: string
  userAgent: string
}

export type SiteSettings = {
  siteName: string
  biography: string
  experience: string
  avatarUrl?: string
  backgroundUrl?: string
  backgroundPositionX?: number
  backgroundPositionY?: number
  backgroundDesktopPositionX?: number
  backgroundDesktopPositionY?: number
  backgroundMobilePositionX?: number
  backgroundMobilePositionY?: number
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

export type ServerStatus = {
  status: 'online'
  uptimeSeconds: number
  lastActivity: string | null
}

export type MusicTrack = {
  id: string
  title: string
  fileUrl: string
  fileName: string
  order: number
  createdAt: string
  fingerprint?: string
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
  coverImagePosition?: string
  coverImageScale?: number
  documentUrl?: string
  documentName?: string
  publishedAt: string
  updatedAt?: string
}
