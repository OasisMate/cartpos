// Renders the selected crop area of an image onto a fixed-size square canvas
// and returns a small JPEG. Used by the avatar cropper so stored photos are
// tiny (~10-30KB) and consistent regardless of the source file size.

export interface PixelCrop {
  x: number
  y: number
  width: number
  height: number
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.addEventListener('load', () => resolve(img))
    img.addEventListener('error', (e) => reject(e))
    img.src = src
  })
}

/**
 * @param src       source image (data URL)
 * @param crop      crop rectangle in source pixels (from react-easy-crop)
 * @param size      output square size in px (default 256)
 * @returns a JPEG File suitable for upload
 */
export async function getCroppedImage(
  src: string,
  crop: PixelCrop,
  size = 256
): Promise<File> {
  const image = await loadImage(src)
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not get canvas context')

  // White backdrop so transparent PNGs don't flatten to black in the JPEG.
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, size, size)
  ctx.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    size,
    size
  )

  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Failed to crop image'))),
      'image/jpeg',
      0.85
    )
  )

  return new File([blob], 'avatar.jpg', { type: 'image/jpeg' })
}
