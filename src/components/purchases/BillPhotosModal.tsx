'use client'

import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import IconButton from '@/components/ui/IconButton'
import { BrandSpinner } from '@/components/ui/BrandSpinner'
import { useToast } from '@/components/ui/ToastProvider'

/**
 * The supplier's bill photos for a purchase, the read side of what the receive
 * screen captures. The images are base64 blobs held off the purchases list, so
 * they are fetched the first time this opens and then kept for the session.
 */

interface Attachment {
  id: string
  image: string
  createdAt: string
}

export default function BillPhotosModal({
  purchaseId,
  reference,
  open,
  onClose,
}: {
  purchaseId: string | null
  reference?: string | null
  open: boolean
  onClose: () => void
}) {
  const { show } = useToast()
  const [attachments, setAttachments] = useState<Attachment[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [index, setIndex] = useState(0)

  const load = useCallback(async () => {
    if (!purchaseId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/purchases/${purchaseId}/attachments`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load bill photos')
      setAttachments(data.attachments || [])
    } catch (err: any) {
      show({ message: err.message || 'Failed to load bill photos', variant: 'destructive' })
      onClose()
    } finally {
      setLoading(false)
    }
  }, [purchaseId, show, onClose])

  // Fetch per purchase, and reset to the first photo whenever a different
  // purchase is opened so the viewer never starts on a stale page.
  useEffect(() => {
    if (!open || !purchaseId) return
    setAttachments(null)
    setIndex(0)
    load()
  }, [open, purchaseId, load])

  const count = attachments?.length ?? 0
  const current = attachments?.[index]

  const step = useCallback(
    (delta: number) => {
      if (count < 2) return
      setIndex((i) => (i + delta + count) % count)
    },
    [count]
  )

  // Arrow keys page through, the way any photo viewer is expected to.
  useEffect(() => {
    if (!open || count < 2) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') step(-1)
      else if (e.key === 'ArrowRight') step(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, count, step])

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={reference ? `Bill photo - ${reference}` : 'Bill photo'}
    >
      {loading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <BrandSpinner size={40} />
        </div>
      ) : count === 0 ? (
        <div className="py-12 text-center text-sm text-gray-500">
          No bill photo was attached to this purchase.
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-center rounded-lg bg-gray-100 p-2">
            {/* A data URL, so next/image would have nothing to optimise. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={current?.image}
              alt={`Supplier bill${count > 1 ? ` ${index + 1} of ${count}` : ''}`}
              className="max-h-[65vh] w-auto max-w-full rounded object-contain"
            />
          </div>

          {count > 1 && (
            <div className="flex items-center justify-center gap-3">
              <IconButton label="Previous photo" onClick={() => step(-1)}>
                <ChevronLeft className="h-4 w-4" />
              </IconButton>
              <span className="text-sm text-gray-500">
                {index + 1} of {count}
              </span>
              <IconButton label="Next photo" onClick={() => step(1)}>
                <ChevronRight className="h-4 w-4" />
              </IconButton>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
