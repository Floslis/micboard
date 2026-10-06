// ─────────────────────────────────────────────────────────────
// MicBoard – Image Utilities
// Client-side image compression and format conversion
// ─────────────────────────────────────────────────────────────

export type ImageMime = 'image/webp' | 'image/jpeg' | 'image/png' | 'image/gif'

export interface ConvertedImage {
  base64: string
  width: number
  height: number
  /** Format the browser actually produced – not necessarily WebP */
  mime: ImageMime
  /** File extension matching `mime` */
  ext: 'webp' | 'jpg' | 'png'
}

/**
 * Convert a File to a compressed base64 image, with optional resize.
 *
 * WebP is preferred. Safari cannot encode WebP: canvas.toDataURL('image/webp')
 * silently returns a PNG there, which for a photo is well over 1 MB. So the
 * result is checked and `fallback` is used instead (JPEG for photos, PNG where
 * transparency matters, e.g. the logo).
 */
export async function fileToWebP(
  file: File,
  maxDimension = 800,
  quality = 0.82,
  fallback: 'jpeg' | 'png' = 'jpeg',
): Promise<ConvertedImage> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)
      const { width, height } = fitDimensions(img.naturalWidth, img.naturalHeight, maxDimension)

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, width, height)

      let dataUrl = canvas.toDataURL('image/webp', quality)
      let mime: ImageMime = 'image/webp'
      let ext: ConvertedImage['ext'] = 'webp'

      if (!dataUrl.startsWith('data:image/webp')) {
        if (fallback === 'png') {
          dataUrl = canvas.toDataURL('image/png')
          mime = 'image/png'
          ext = 'png'
        } else {
          // JPEG has no alpha channel – transparent areas would turn black
          ctx.globalCompositeOperation = 'destination-over'
          ctx.fillStyle = '#ffffff'
          ctx.fillRect(0, 0, width, height)
          dataUrl = canvas.toDataURL('image/jpeg', quality)
          mime = 'image/jpeg'
          ext = 'jpg'
        }
      }

      resolve({ base64: dataUrl.split(',')[1], width, height, mime, ext })
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image'))
    }
    img.src = url
  })
}

/**
 * Detect the real image format from the first bytes.
 * File extensions in the data repo are not reliable (see fileToWebP).
 */
export function sniffImageMime(bytes: Uint8Array): ImageMime | null {
  if (bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
    && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return 'image/webp'
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  if (bytes.length >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png'
  if (bytes.length >= 3 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return 'image/gif'
  return null
}

/** Convert a File to a base64 string (no format conversion) */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve(result.split(',')[1])
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

/** Scale dimensions so the longest edge <= maxDimension */
function fitDimensions(
  w: number,
  h: number,
  max: number,
): { width: number; height: number } {
  if (w <= max && h <= max) return { width: w, height: h }
  if (w >= h) {
    return { width: max, height: Math.round((h / w) * max) }
  }
  return { width: Math.round((w / h) * max), height: max }
}

/** Build a CSS background-position string from x/y percentages (0–100) */
export function positionToCss(x = 50, y = 30): string {
  return `${x}% ${y}%`
}

/** Build a CSS background-size string from a scale factor */
export function scaleToCss(scale = 1.1): string {
  return `${Math.round(scale * 100)}%`
}

/** Generate a unique file name for an uploaded image */
export function generateImageFilename(userId: string, ext = 'webp'): string {
  return `images/${userId}.${ext}`
}

/** Check if a file is a supported image type */
export function isValidImageFile(file: File): boolean {
  return ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)
}
