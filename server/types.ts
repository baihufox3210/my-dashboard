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

export type Friend = { id: string; name: string; introduction: string; url: string; avatarUrl?: string }
export type Project = { id: string; title: string; summary: string; description: string; category: string; tags: string[]; projectUrl: string; coverImage?: string; coverImagePosition?: string; coverImageScale?: number; documentUrl?: string; documentName?: string; publishedAt: string; updatedAt?: string }
export type MusicTrack = { id: string; title: string; fileUrl: string; fileName: string; order: number; createdAt: string; fingerprint?: string }

export type AnalyticsPage = 'home' | 'about' | 'projects' | 'blog' | 'article' | 'contact' | 'friends'
export type AnalyticsDevice = 'mobile' | 'tablet' | 'desktop'
export type AnalyticsSource = 'direct' | 'search' | 'social' | 'referral'
export type AnalyticsRegion = { country: string; region: string }
export type AnalyticsRegionRow = AnalyticsRegion & { day: string; views: number }
export type AnalyticsRow = { day: string; page: AnalyticsPage; device: AnalyticsDevice; views: number; articleId?: string; source?: AnalyticsSource }
export type ActivityEntry = { at: string; type: 'article' | 'homepage' | 'site'; action: 'published' | 'updated' | 'deleted' | 'saved'; title: string }

export const defaultHomeProfile: HomeProfile = {
  name: 'baihu',
  introduction: '喜歡動手做，也喜歡把有趣的想法變成作品。',
  quote: 'Stay curious, keep building.',
  socials: [
    { name: 'Instagram', url: 'https://www.instagram.com/baihu3210' },
    { name: 'Discord', url: 'https://discord.com/users/808972376619483137' },
    { name: 'GitHub', url: 'https://github.com/baihufox3210' },
  ],
  tags: [],
  avatarMessages: ['嗨，歡迎來逛逛！ (｡•̀ᴗ-)✧', '今天也要保持好奇心！ (ง •̀_•́)ง', '謝謝你來看我的網站～ (´▽`ʃ♡ƪ)'],
  updateTitle: '最近在做什麼',
  updateText: '目前專注在機器人、程式與新點子的實作。',
}

export const defaultSiteSettings: SiteSettings = {
  siteName: 'Baihu Personal Website',
  biography: '',
  experience: '',
}
