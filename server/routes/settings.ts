import { Router } from 'express'
import { requireAuthentication, requireSameOrigin } from '../security.js'
import { readHomeProfile, readSiteSettings, recordActivity, writeHomeProfile, writeSiteSettings } from '../storage.js'
import { defaultHomeProfile, defaultSiteSettings, type HomeProfile, type SiteSettings } from '../types.js'
import { discardUploadedFiles, removeUnusedUploads, upload, uploadedFiles, validateUploadedImages } from '../uploads.js'
import { boundedText, isSafeSocialUrl } from '../validation.js'

const router = Router()

router.put(
  '/site-settings',
  requireSameOrigin,
  requireAuthentication,
  upload.fields([
    { name: 'avatar', maxCount: 1 },
    { name: 'background', maxCount: 1 },
  ]),
  validateUploadedImages,
  async (request, response) => {
    const files = request.files as { avatar?: Express.Multer.File[]; background?: Express.Multer.File[] } | undefined
    const existingSettings = await readSiteSettings()
    const {
      siteName,
      biography,
      experience,
      backgroundPositionX,
      backgroundPositionY,
      backgroundDesktopPositionX,
      backgroundDesktopPositionY,
      backgroundMobilePositionX,
      backgroundMobilePositionY,
    } = request.body as {
      siteName?: string
      biography?: string
      experience?: string
      backgroundPositionX?: string
      backgroundPositionY?: string
      backgroundDesktopPositionX?: string
      backgroundDesktopPositionY?: string
      backgroundMobilePositionX?: string
      backgroundMobilePositionY?: string
    }
    if (!boundedText(siteName ?? '', 120) || !boundedText(biography ?? '', 20_000) || !boundedText(experience ?? '', 50_000)) {
      await discardUploadedFiles(uploadedFiles(request))
      response.status(400).json({ message: '網站名稱、自我介紹或經歷超過字數限制。' })
      return
    }
    const position = (value: string | undefined, fallback: number) => {
      const parsed = Number(value)
      return Number.isFinite(parsed) ? Math.max(0, Math.min(100, parsed)) : fallback
    }

    const updatedSettings: SiteSettings = {
      ...existingSettings,
      siteName: siteName?.trim() || defaultSiteSettings.siteName,
      biography: biography?.trim() || '',
      experience: experience?.trim() || '',
      backgroundPositionX: position(backgroundPositionX, existingSettings.backgroundPositionX ?? 50),
      backgroundPositionY: position(backgroundPositionY, existingSettings.backgroundPositionY ?? 50),
      backgroundDesktopPositionX: position(backgroundDesktopPositionX, existingSettings.backgroundDesktopPositionX ?? existingSettings.backgroundPositionX ?? 50),
      backgroundDesktopPositionY: position(backgroundDesktopPositionY, existingSettings.backgroundDesktopPositionY ?? existingSettings.backgroundPositionY ?? 50),
      backgroundMobilePositionX: position(backgroundMobilePositionX, existingSettings.backgroundMobilePositionX ?? existingSettings.backgroundPositionX ?? 50),
      backgroundMobilePositionY: position(backgroundMobilePositionY, existingSettings.backgroundMobilePositionY ?? existingSettings.backgroundPositionY ?? 50),
      ...(files?.avatar?.[0] ? { avatarUrl: `/uploads/${files.avatar[0].filename}` } : {}),
      ...(files?.background?.[0] ? { backgroundUrl: `/uploads/${files.background[0].filename}` } : {}),
    }

    await writeSiteSettings(updatedSettings)
    await removeUnusedUploads(
      files?.avatar?.[0] ? existingSettings.avatarUrl : undefined,
      files?.background?.[0] ? existingSettings.backgroundUrl : undefined,
    )
    await recordActivity({ at: new Date().toISOString(), type: 'site', action: 'saved', title: '網站設定' })
    response.json(updatedSettings)
  },
)

router.put('/home-profile', requireSameOrigin, requireAuthentication, upload.single('avatar'), validateUploadedImages, async (request, response) => {
  const existing = await readHomeProfile()
  const body = request.body as Partial<Record<keyof HomeProfile, string>>
  let socials: HomeProfile['socials']
  let tags: string[]
  let avatarMessages: string[]
  try {
    socials = JSON.parse(body.socials ?? '[]') as HomeProfile['socials']
    tags = JSON.parse(body.tags ?? '[]') as string[]
    avatarMessages = JSON.parse(body.avatarMessages ?? '[]') as string[]
  } catch {
    await discardUploadedFiles(uploadedFiles(request))
    response.status(400).json({ message: 'Social links and tags must be valid JSON.' })
    return
  }
  const textLimits: [keyof HomeProfile, number][] = [['name', 120], ['introduction', 5000], ['quote', 500], ['updateTitle', 160], ['updateText', 5000]]
  const invalidMessage =
    !textLimits.every(([key, limit]) => boundedText(body[key] ?? '', limit)) ? 'Profile text is invalid or too long.'
      : !Array.isArray(socials) || socials.length > 20 || !socials.every((item) => item && boundedText(item.name, 80) && boundedText(item.url, 2048) && isSafeSocialUrl(item.url.trim())) ? 'Social links are invalid.'
        : !Array.isArray(tags) || tags.length > 50 || !tags.every((tag) => boundedText(tag, 80)) ? 'Tags are invalid.'
          : !Array.isArray(avatarMessages) || avatarMessages.length > 20 || !avatarMessages.every((message) => boundedText(message, 160)) ? 'Avatar messages are invalid.'
            : undefined
  if (invalidMessage) {
    await discardUploadedFiles(uploadedFiles(request))
    response.status(400).json({ message: invalidMessage })
    return
  }
  const updated: HomeProfile = {
    name: body.name?.trim() || defaultHomeProfile.name,
    introduction: body.introduction?.trim() ?? '',
    quote: body.quote?.trim() ?? '',
    socials: socials.map(({ name, url }) => ({ name: name.trim(), url: url.trim() })).filter(({ name, url }) => name && url),
    tags: tags.map((tag) => tag.trim()).filter(Boolean),
    avatarMessages: avatarMessages.map((message) => message.trim()).filter(Boolean),
    updateTitle: body.updateTitle?.trim() || defaultHomeProfile.updateTitle,
    updateText: body.updateText?.trim() ?? '',
    ...(request.file ? { avatarUrl: `/uploads/${request.file.filename}` } : existing.avatarUrl ? { avatarUrl: existing.avatarUrl } : {}),
  }
  await writeHomeProfile(updated)
  if (request.file) await removeUnusedUploads(existing.avatarUrl)
  await recordActivity({ at: new Date().toISOString(), type: 'homepage', action: 'saved', title: '首頁個人介紹' })
  response.json(updated)
})

export default router
