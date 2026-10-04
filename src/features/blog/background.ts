import type { SiteSettings } from './article'

let contrastRequest = 0

type PaletteName = 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'neutral'

type Palette = { primary: string; strong: string }

const paletteColors: Record<PaletteName, Palette> = {
  red: { primary: '#b96562', strong: '#7d3f3d' },
  orange: { primary: '#b4774f', strong: '#754833' },
  // A muted olive-brown accent avoids yellow-on-yellow UI on warm backgrounds.
  yellow: { primary: '#927348', strong: '#5f482f' },
  green: { primary: '#56856b', strong: '#315a45' },
  blue: { primary: '#587eab', strong: '#355676' },
  purple: { primary: '#806aa9', strong: '#554378' },
  neutral: { primary: '#756b63', strong: '#4b433d' },
}

const themeProperties = [
  '--theme-primary',
  '--theme-primary-strong',
  '--theme-primary-soft',
  '--theme-control-background',
  '--theme-control-foreground',
  '--theme-page-base',
  '--theme-ink',
  '--theme-card-ink',
  '--theme-muted',
  '--theme-muted-on-background',
  '--theme-line',
  '--theme-surface',
  '--theme-surface-raised',
  '--theme-surface-border',
  '--theme-chrome',
  '--theme-chrome-border',
  '--theme-overlay',
  '--theme-backdrop',
  '--theme-shadow',
]

type Rgb = [number, number, number]

function hexToRgb(hex: string): Rgb {
  const value = hex.replace('#', '')
  return [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16)) as Rgb
}

function mix(from: Rgb, to: Rgb, amount: number): Rgb {
  return from.map((channel, index) => Math.round(channel + ((to[index] ?? 0) - channel) * amount)) as Rgb
}

function rgba(color: Rgb, alpha: number) {
  return `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha})`
}

function rgbHex(color: Rgb) {
  return `#${color.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`
}

function getPaletteName(red: number, green: number, blue: number): PaletteName {
  const maximum = Math.max(red, green, blue)
  const minimum = Math.min(red, green, blue)
  const saturation = maximum === 0 ? 0 : (maximum - minimum) / maximum
  if (saturation < 0.18) return 'neutral'

  const hue = maximum === red
    ? 60 * ((green - blue) / (maximum - minimum) % 6)
    : maximum === green
      ? 60 * ((blue - red) / (maximum - minimum) + 2)
      : 60 * ((red - green) / (maximum - minimum) + 4)
  const normalizedHue = hue < 0 ? hue + 360 : hue

  if (normalizedHue < 15 || normalizedHue >= 345) return 'red'
  if (normalizedHue < 45) return 'orange'
  if (normalizedHue < 75) return 'yellow'
  if (normalizedHue < 165) return 'green'
  if (normalizedHue < 255) return 'blue'
  return 'purple'
}

function resetThemeColors() {
  const body = document.body
  body.classList.remove('theme-red', 'theme-orange', 'theme-yellow', 'theme-green', 'theme-blue', 'theme-purple', 'theme-neutral')
  body.classList.remove('site-background-dark')
  body.classList.add('site-background-light')
  for (const property of themeProperties) body.style.removeProperty(property)
  document.documentElement.style.removeProperty('--theme-page-base')
}

function applyPalette(paletteName: PaletteName, dark: boolean) {
  const body = document.body
  const palette = paletteColors[paletteName]
  const white: Rgb = [255, 255, 255]
  const black: Rgb = [0, 0, 0]
  const primary = hexToRgb(palette.primary)
  const strong = hexToRgb(palette.strong)
  const ink = mix(strong, black, 0.62)
  const muted = mix(strong, white, 0.14)
  const controlBackground = rgba(primary, 0.3)
  const pageBase = dark ? rgbHex(mix(primary, black, 0.88)) : rgbHex(mix(primary, white, 0.9))

  body.classList.remove('theme-red', 'theme-orange', 'theme-yellow', 'theme-green', 'theme-blue', 'theme-purple', 'theme-neutral')
  body.classList.add(`theme-${paletteName}`)
  body.classList.toggle('site-background-dark', dark)
  body.classList.toggle('site-background-light', !dark)
  const properties: Record<string, string> = {
    '--theme-primary': palette.primary,
    '--theme-primary-strong': palette.strong,
    '--theme-primary-soft': controlBackground,
    '--theme-control-background': controlBackground,
    '--theme-control-foreground': palette.strong,
    '--theme-page-base': pageBase,
    '--theme-ink': dark ? rgbHex(mix(primary, white, 0.94)) : rgbHex(ink),
    '--theme-card-ink': rgbHex(ink),
    '--theme-muted': rgbHex(muted),
    '--theme-muted-on-background': dark ? rgbHex(mix(primary, white, 0.8)) : rgbHex(muted),
    '--theme-line': rgba(primary, 0.34),
    // White glass tinted by the sampled hue; the same recipe feeds panels and site chrome.
    '--theme-surface': rgba(mix(white, primary, 0.07), 0.72),
    '--theme-surface-raised': rgba(mix(white, primary, 0.05), 0.88),
    '--theme-surface-border': rgba(mix(white, primary, 0.1), 0.66),
    '--theme-chrome': rgba(mix(white, primary, 0.2), 0.66),
    '--theme-chrome-border': rgba(mix(white, primary, 0.38), 0.55),
    '--theme-overlay': rgba(mix(strong, black, 0.55), 0.62),
    '--theme-backdrop': rgba(mix(strong, black, 0.6), 0.5),
    '--theme-shadow': `0 1rem 2.5rem ${rgba(mix(strong, black, 0.4), 0.14)}`,
  }
  for (const [name, value] of Object.entries(properties)) body.style.setProperty(name, value)
  document.documentElement.style.setProperty('--theme-page-base', pageBase)
}

function applyBackgroundContrast(imageUrl?: string): Promise<void> {
  const requestId = ++contrastRequest
  if (!imageUrl) {
    resetThemeColors()
    return Promise.resolve()
  }

  return new Promise((resolve) => {
    const image = new Image()
    image.decoding = 'async'
    image.onload = () => {
      if (requestId !== contrastRequest) {
        resolve()
        return
      }

      try {
        const canvas = document.createElement('canvas')
        canvas.width = 32
        canvas.height = 32
        const context = canvas.getContext('2d', { willReadFrequently: true })
        if (!context) {
          resetThemeColors()
          resolve()
          return
        }

        context.drawImage(image, 0, 0, canvas.width, canvas.height)
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
        let red = 0
        let green = 0
        let blue = 0
        let luminance = 0
        let weight = 0
        const buckets = new Map<string, { count: number; red: number; green: number; blue: number }>()

        for (let index = 0; index < pixels.length; index += 4) {
          const alpha = (pixels[index + 3] ?? 0) / 255
          if (alpha < 0.1) continue

          const pixelRed = pixels[index] ?? 0
          const pixelGreen = pixels[index + 1] ?? 0
          const pixelBlue = pixels[index + 2] ?? 0
          red += pixelRed * alpha
          green += pixelGreen * alpha
          blue += pixelBlue * alpha
          luminance += (0.2126 * pixelRed + 0.7152 * pixelGreen + 0.0722 * pixelBlue) * alpha

          const bucketRed = Math.min(255, Math.floor(pixelRed / 32) * 32 + 16)
          const bucketGreen = Math.min(255, Math.floor(pixelGreen / 32) * 32 + 16)
          const bucketBlue = Math.min(255, Math.floor(pixelBlue / 32) * 32 + 16)
          const key = `${bucketRed},${bucketGreen},${bucketBlue}`
          const bucket = buckets.get(key) ?? { count: 0, red: bucketRed, green: bucketGreen, blue: bucketBlue }
          bucket.count += alpha
          buckets.set(key, bucket)
          weight += alpha
        }

        if (!weight) {
          resetThemeColors()
          resolve()
          return
        }

        const averageLuminance = luminance / weight
        const averageRed = Math.round(red / weight)
        const averageGreen = Math.round(green / weight)
        const averageBlue = Math.round(blue / weight)
        const dominant = [...buckets.values()].sort((first, second) => second.count - first.count)[0]
          ?? { red: averageRed, green: averageGreen, blue: averageBlue }
        applyPalette(getPaletteName(dominant.red, dominant.green, dominant.blue), averageLuminance < 145)
      } catch {
        resetThemeColors()
      }
      resolve()
    }
    image.onerror = () => {
      if (requestId === contrastRequest) resetThemeColors()
      resolve()
    }
    image.src = imageUrl
  })
}

export function applySiteBackground(
  settings: Pick<SiteSettings, 'backgroundUrl' | 'backgroundPositionX' | 'backgroundPositionY' | 'backgroundDesktopPositionX' | 'backgroundDesktopPositionY' | 'backgroundMobilePositionX' | 'backgroundMobilePositionY'>,
  analyzeColors = true,
): Promise<void> {
  const fallbackX = settings.backgroundPositionX ?? 50
  const fallbackY = settings.backgroundPositionY ?? 50
  const desktopPosition = `${settings.backgroundDesktopPositionX ?? fallbackX}% ${settings.backgroundDesktopPositionY ?? fallbackY}%`
  const mobilePosition = `${settings.backgroundMobilePositionX ?? fallbackX}% ${settings.backgroundMobilePositionY ?? fallbackY}%`
  const image = settings.backgroundUrl ? `url("${settings.backgroundUrl}")` : 'none'
  const body = document.body

  body.style.setProperty('--site-background-image', image)
  body.style.setProperty('--site-background-position-desktop', desktopPosition)
  body.style.setProperty('--site-background-position-mobile', mobilePosition)
  const position = window.innerWidth <= 768 ? mobilePosition : desktopPosition
  body.style.setProperty('--site-background-position', position)
  body.style.backgroundImage = image
  body.style.backgroundPosition = position
  return analyzeColors ? applyBackgroundContrast(settings.backgroundUrl) : Promise.resolve()
}
