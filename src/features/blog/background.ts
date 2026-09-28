import type { SiteSettings } from './article'

export function applySiteBackground(settings: Pick<SiteSettings, 'backgroundUrl' | 'backgroundPositionX' | 'backgroundPositionY'>) {
  const position = `${settings.backgroundPositionX ?? 50}% ${settings.backgroundPositionY ?? 50}%`
  const image = settings.backgroundUrl ? `url("${settings.backgroundUrl}")` : 'none'
  document.body.style.setProperty('--site-background-image', image)
  document.body.style.setProperty('--site-background-position', position)
  document.body.style.backgroundImage = image
  document.body.style.backgroundPosition = position
}
