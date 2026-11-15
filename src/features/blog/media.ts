export function resolveSameOriginMediaUrl(value: string) {
  if (!value) return ''

  try {
    const url = new URL(value, window.location.origin)
    if (url.origin !== window.location.origin) return ''
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return ''
  }
}

// Inline style for a saved cover crop. The image covers a wide 7:2 frame, is zoomed by
// `scale`, and `position` says where along the hidden overflow the frame sits (0% = left
// or top edge, 100% = right or bottom edge). Zooming around the same point as the
// position keeps that meaning at every zoom level, so every part of the image is reachable.
export function coverImageStyle(item: { coverImagePosition?: string; coverImageScale?: number }) {
  const position = item.coverImagePosition ?? '50% 50%'
  return { objectPosition: position, transformOrigin: position, transform: `scale(${item.coverImageScale ?? 1})` }
}

const uploadableImageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const maxImageBytes = 8 * 1024 * 1024
const maxImageSide = 3200

function decodeImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => { URL.revokeObjectURL(url); resolve(image) }
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode failed')) }
    image.src = url
  })
}

function encodeCanvas(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality))
}

// The server takes JPEG, PNG, WebP or GIF up to 8 MB. Anything else the browser can
// open (HEIC photos from an iPhone, AVIF, BMP…) or anything too large is re-encoded,
// as WebP when the browser can (keeps transparency) and JPEG otherwise. If that fails,
// the original goes up and the server explains what is wrong with it.
export async function prepareImageUpload(file: File): Promise<File> {
  if ((uploadableImageTypes.includes(file.type) && file.size <= maxImageBytes) || file.type === 'image/gif') return file
  try {
    const image = await decodeImage(file)
    const scale = Math.min(1, maxImageSide / Math.max(image.naturalWidth, image.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
    const context = canvas.getContext('2d')
    if (!context) return file
    const baseName = file.name.replace(/\.[^.]+$/, '') || 'image'
    for (const quality of [.9, .8, .7, .6]) {
      context.clearRect(0, 0, canvas.width, canvas.height)
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      const webp = await encodeCanvas(canvas, 'image/webp', quality)
      if (webp?.type === 'image/webp' && webp.size <= maxImageBytes) return new File([webp], `${baseName}.webp`, { type: 'image/webp' })
      // JPEG has no transparency: paint white behind the image first.
      context.globalCompositeOperation = 'destination-over'
      context.fillStyle = '#fff'
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.globalCompositeOperation = 'source-over'
      const jpeg = await encodeCanvas(canvas, 'image/jpeg', quality)
      if (jpeg && jpeg.size <= maxImageBytes) return new File([jpeg], `${baseName}.jpg`, { type: 'image/jpeg' })
    }
  } catch {
    // Not an image this browser can open.
  }
  return file
}
