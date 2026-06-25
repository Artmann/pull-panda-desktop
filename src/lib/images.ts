// Maps lowercase file extensions to the media type used when serving the
// blob bytes back to the renderer. Raster formats only — SVG is text and is
// rendered through the regular diff path, so it is intentionally absent.
const mediaTypesByExtension: Record<string, string> = {
  avif: 'image/avif',
  bmp: 'image/bmp',
  gif: 'image/gif',
  ico: 'image/x-icon',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  webp: 'image/webp'
}

function extensionOf(filePath: string): string {
  const lastDotIndex = filePath.lastIndexOf('.')

  if (lastDotIndex === -1) {
    return ''
  }

  return filePath.slice(lastDotIndex + 1).toLowerCase()
}

export function imageMediaType(filePath: string): string | null {
  return mediaTypesByExtension[extensionOf(filePath)] ?? null
}

export function isImagePath(filePath: string): boolean {
  return imageMediaType(filePath) !== null
}
