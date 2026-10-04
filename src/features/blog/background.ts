import type { SiteSettings } from './article'

export function applySiteBackground(
  settings: Pick<SiteSettings, 'backgroundUrl' | 'backgroundPositionX' | 'backgroundPositionY' | 'backgroundDesktopPositionX' | 'backgroundDesktopPositionY' | 'backgroundMobilePositionX' | 'backgroundMobilePositionY'>,
) {
  const fallbackX = settings.backgroundPositionX ?? 50
  const fallbackY = settings.backgroundPositionY ?? 50
  const desktopPosition = `${settings.backgroundDesktopPositionX ?? fallbackX}% ${settings.backgroundDesktopPositionY ?? fallbackY}%`
  const mobilePosition = `${settings.backgroundMobilePositionX ?? fallbackX}% ${settings.backgroundMobilePositionY ?? fallbackY}%`
  const image = settings.backgroundUrl ? `url("${settings.backgroundUrl}")` : 'none'
  document.body.style.setProperty('--site-background-image', image)
  document.body.style.setProperty('--site-background-position-desktop', desktopPosition)
  document.body.style.setProperty('--site-background-position-mobile', mobilePosition)
  const position = window.innerWidth <= 768 ? mobilePosition : desktopPosition
  document.body.style.setProperty('--site-background-position', position)
  document.body.style.backgroundImage = image
  document.body.style.backgroundPosition = position
}
