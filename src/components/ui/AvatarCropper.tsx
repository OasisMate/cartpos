'use client'

import { useCallback, useState } from 'react'
import Cropper, { Area } from 'react-easy-crop'
import { getCroppedImage } from '@/lib/utils/cropImage'

/**
 * Square (1:1) avatar cropper in a modal. Lets the user pan + zoom, then
 * outputs a small 256x256 JPEG File via onCropped. Source-only client UI.
 */
export function AvatarCropper({
  src,
  onCancel,
  onCropped,
}: {
  src: string
  onCancel: () => void
  onCropped: (file: File) => void
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [areaPixels, setAreaPixels] = useState<Area | null>(null)
  const [processing, setProcessing] = useState(false)

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setAreaPixels(pixels)
  }, [])

  const handleApply = async () => {
    if (!areaPixels) return
    setProcessing(true)
    try {
      const file = await getCroppedImage(src, areaPixels, 256)
      onCropped(file)
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Adjust photo</h3>
          <p className="text-xs text-gray-500">Drag to reposition, slide to zoom.</p>
        </div>

        <div className="relative h-72 bg-gray-900">
          <Cropper
            image={src}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        <div className="px-5 py-4 space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500">Zoom</span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 accent-blue-600"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={processing}
              className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={processing || !areaPixels}
              className="px-3 py-1.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {processing ? 'Processing...' : 'Apply'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
