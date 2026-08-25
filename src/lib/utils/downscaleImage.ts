/**
 * Phone photos of a supplier bill are 3-5MB. They are stored as base64 in
 * Postgres, so they get downscaled in the browser first: 1600px on the long
 * edge at JPEG 0.7 lands around 200-400KB, which is readable and cheap.
 */

export function fitWithin(width: number, height: number, maxEdge: number) {
  const longest = Math.max(width, height)
  if (longest <= maxEdge) return { width, height }
  const scale = maxEdge / longest
  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}

export async function downscaleImage(
  file: File,
  options: { maxEdge?: number; quality?: number } = {}
): Promise<Blob> {
  const maxEdge = options.maxEdge ?? 1600
  const quality = options.quality ?? 0.7

  const bitmap = await createImageBitmap(file)
  const { width, height } = fitWithin(bitmap.width, bitmap.height, maxEdge)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not read the image')
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', quality)
  )
  if (!blob) throw new Error('Could not process the image')
  return blob
}
