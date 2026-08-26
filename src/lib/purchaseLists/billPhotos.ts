/**
 * Rules for a supplier bill photo attached to a received purchase list.
 *
 * Shared so every route that accepts one of these photos (this one, and a
 * later route that edits attachments after the fact) enforces the same
 * limits the same way instead of the two slowly drifting apart.
 */
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024
export const MAX_IMAGES = 3
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png'] as const

export type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number]

function isAllowedImageType(type: string): type is AllowedImageType {
  return (ALLOWED_IMAGE_TYPES as readonly string[]).includes(type)
}

/**
 * Turn an uploaded File into a base64 data URL, after checking its type and
 * size. Throws a plain Error with a message that is safe to show the
 * shopkeeper directly - callers own turning that into a 400, this helper
 * never talks HTTP.
 */
export async function fileToValidatedDataUrl(file: File): Promise<string> {
  if (!isAllowedImageType(file.type)) {
    throw new Error('Only JPG or PNG photos are allowed')
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error('Each photo must be under 2MB')
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  return `data:${file.type};base64,${buffer.toString('base64')}`
}
