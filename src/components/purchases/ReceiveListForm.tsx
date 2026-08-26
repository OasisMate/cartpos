'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Camera, Loader2, X } from 'lucide-react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import IconButton from '@/components/ui/IconButton'
import { useToast } from '@/components/ui/ToastProvider'
import { formatCurrency } from '@/lib/utils/money'
import { downscaleImage } from '@/lib/utils/downscaleImage'

/**
 * The receive screen: where a purchase list stops being a checklist and
 * becomes real stock. The shopkeeper confirms what actually arrived, types
 * what it cost (a pack cost, never a per-piece one), and can attach up to
 * three photos of the supplier's bill.
 *
 * Mirrors the shape of GET /api/purchase-lists/{id} used by the builder
 * (src/app/backoffice/purchase-lists/[id]/page.tsx), kept as a local copy
 * rather than shared since the two screens need different derived fields.
 */

const MAX_IMAGES = 3

interface LineProduct {
  id: string
  name: string
  unit: string
  barcode: string | null
}

interface PurchaseListLine {
  id: string
  quantity: number | string
  packName: string | null
  unitsPerItem: number | string
  /** Null for an off-catalogue item: order-only, never received. */
  product: LineProduct | null
  customName: string | null
}

interface SupplierLite {
  id: string
  name: string
  phone: string | null
}

interface PurchaseListDetail {
  id: string
  status: 'DRAFT' | 'SENT' | 'RECEIVED'
  supplierId: string | null
  reference?: string | null
  lines: PurchaseListLine[]
}

interface DraftLine {
  lineId: string
  productId: string
  name: string
  barcode: string | null
  packLabel: string
  unitsPerItem: number
  quantity: string
  cost: string
}

interface PhotoDraft {
  id: string
  file: File
  previewUrl: string
}

function todayInputValue(): string {
  const now = new Date()
  const offset = now.getTimezoneOffset()
  return new Date(now.getTime() - offset * 60000).toISOString().slice(0, 10)
}

/** The per-piece cost that will actually land on the purchase line, shown as a
 * quiet hint under the pack-cost input so a typo never surprises anyone later. */
function perPieceHint(cost: string, unitsPerItem: number): string | null {
  if (unitsPerItem <= 1) return null
  const value = Number(cost)
  if (cost.trim() === '' || !Number.isFinite(value) || value <= 0) return null
  return `${formatCurrency(value / unitsPerItem, 'Rs ')} each`
}

export default function ReceiveListForm({ listId }: { listId: string }) {
  const router = useRouter()
  const { show } = useToast()

  const [list, setList] = useState<PurchaseListDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [suppliers, setSuppliers] = useState<SupplierLite[]>([])

  const [supplierId, setSupplierId] = useState('')
  const [date, setDate] = useState(todayInputValue())
  const [reference, setReference] = useState('')
  const [onCredit, setOnCredit] = useState(false)
  const [lines, setLines] = useState<DraftLine[]>([])
  /** Names of off-catalogue items on the list, shown but not received. */
  const [skipped, setSkipped] = useState<string[]>([])
  const [photos, setPhotos] = useState<PhotoDraft[]>([])
  const [submitting, setSubmitting] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  // Revokes every still-live object URL on unmount, so a shopkeeper bouncing
  // between screens never leaks a blob URL per photo they looked at.
  const photosRef = useRef<PhotoDraft[]>([])
  useEffect(() => {
    photosRef.current = photos
  }, [photos])
  useEffect(() => {
    return () => {
      for (const p of photosRef.current) URL.revokeObjectURL(p.previewUrl)
    }
  }, [])

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/purchase-lists/${listId}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load list')
      setList(data)
      setSupplierId(data.supplierId || '')
      // Off-catalogue lines are order-only: they went to the supplier on the
      // shared list, but there is no product to move stock against, so they are
      // not part of the receive. Named below the form so nothing looks lost.
      const all: PurchaseListLine[] = data.lines || []
      setSkipped(all.filter((line) => !line.product).map((line) => line.customName || 'Item'))
      setLines(
        all
          .filter((line) => line.product)
          .map((line) => {
            const unitsPerItem = Number(line.unitsPerItem) || 1
            return {
              lineId: line.id,
              productId: line.product!.id,
              name: line.product!.name,
              barcode: line.product!.barcode,
              packLabel: line.packName || line.product!.unit,
              unitsPerItem,
              quantity: String(Number(line.quantity)),
              cost: '',
            }
          })
      )
      setLoadError('')
    } catch (err: any) {
      setLoadError(err.message || 'Failed to load list')
    } finally {
      setLoading(false)
    }
  }, [listId])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    fetch('/api/suppliers?limit=200')
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to load suppliers')
        setSuppliers(data.suppliers || [])
      })
      .catch((err: any) => {
        show({ message: err.message || 'Failed to load suppliers', variant: 'destructive' })
      })
  }, [show])

  function updateLine(lineId: string, patch: Partial<DraftLine>) {
    setLines((current) => current.map((l) => (l.lineId === lineId ? { ...l, ...patch } : l)))
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    if (files.length === 0) return

    const remaining = MAX_IMAGES - photos.length
    if (remaining <= 0) {
      show({ message: `Only ${MAX_IMAGES} photos allowed`, variant: 'destructive' })
      return
    }
    if (files.length > remaining) {
      show({ message: `Only ${MAX_IMAGES} photos allowed, took the first ${remaining}`, variant: 'destructive' })
    }

    const accepted = files.slice(0, remaining)
    setPhotos((current) => [
      ...current,
      ...accepted.map((file) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        previewUrl: URL.createObjectURL(file),
      })),
    ])
  }

  function removePhoto(id: string) {
    setPhotos((current) => {
      const target = current.find((p) => p.id === id)
      if (target) URL.revokeObjectURL(target.previewUrl)
      return current.filter((p) => p.id !== id)
    })
  }

  async function handleSubmit() {
    if (!list || submitting) return

    for (const line of lines) {
      const qty = Number(line.quantity)
      if (line.quantity.trim() === '' || !Number.isFinite(qty) || qty <= 0) {
        show({ message: `Enter a valid quantity for ${line.name}`, variant: 'destructive' })
        return
      }
    }

    setSubmitting(true)
    try {
      const blobs = await Promise.all(photos.map((p) => downscaleImage(p.file)))

      const payload = {
        lines: lines.map((line) => ({
          productId: line.productId,
          // The pack quantity and pack cost, exactly as entered. The server
          // converts to pieces and per-piece cost using the list's own
          // unitsPerItem, never this client.
          quantity: Number(line.quantity),
          unitCost: line.cost.trim() === '' ? undefined : Number(line.cost),
        })),
        supplierId: supplierId || undefined,
        date,
        reference: reference.trim() || undefined,
        onCredit,
      }

      const formData = new FormData()
      formData.append('payload', JSON.stringify(payload))
      blobs.forEach((blob, i) => formData.append('image', blob, `bill-${i + 1}.jpg`))

      const res = await fetch(`/api/purchase-lists/${listId}/receive`, {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to receive purchase')

      show({ message: 'Purchase received', variant: 'success' })
      router.push('/store/purchases')
    } catch (err: any) {
      show({ message: err.message || 'Failed to receive purchase', variant: 'destructive' })
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div className="p-6 text-center text-sm text-gray-500">Loading...</div>
  }
  if (!list) {
    return (
      <div className="p-6 text-center text-sm text-gray-500">
        {loadError || 'This list could not be found.'}
      </div>
    )
  }

  return (
    <div className="flex min-h-[calc(100dvh-10rem)] sm:min-h-[calc(100dvh-7rem)] flex-col bg-gray-50">
      <div className="sticky top-0 z-10 border-b border-gray-200 bg-white">
        <div className="mx-auto flex w-full max-w-4xl items-center gap-2 px-4 py-3">
        <Link
          href={`/store/purchase-lists/${listId}`}
          className="shrink-0 text-gray-500 hover:text-gray-700"
          aria-label="Back to list"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="min-w-0 flex-1 truncate font-semibold text-gray-900">Receive purchase</h1>
        </div>
      </div>

      <div className="mx-auto w-full max-w-4xl flex-1 space-y-3 px-4 py-3">
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-500">Supplier</span>
              <Select
                className="h-11 w-full"
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
              >
                <option value="">No supplier</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-500">Date</span>
              <Input
                type="date"
                className="h-11 w-full"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>

            <label className="block sm:col-span-2">
              <span className="mb-1 block text-xs font-medium text-gray-500">Reference</span>
              <Input
                className="h-11 w-full text-base"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Supplier's bill number"
              />
            </label>
          </div>

          <label className="mt-3 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300"
              checked={onCredit}
              disabled={!supplierId}
              onChange={(e) => setOnCredit(e.target.checked)}
            />
            <span className={supplierId ? 'text-gray-900' : 'text-gray-400'}>
              On credit, add total to supplier balance
            </span>
          </label>
        </div>

        <div className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white px-3">
          {lines.map((line) => {
            const hint = perPieceHint(line.cost, line.unitsPerItem)
            return (
              <div key={line.lineId} className="py-3">
                <div className="min-w-0">
                  <div className="line-clamp-2 text-sm font-medium text-gray-900">{line.name}</div>
                  {line.barcode && <div className="truncate text-xs text-gray-400">{line.barcode}</div>}
                </div>

                <div className="mt-2 grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="mb-1 block text-xs text-gray-500">Qty ({line.packLabel})</span>
                    <input
                      className="input h-11 w-full text-base"
                      inputMode="decimal"
                      value={line.quantity}
                      onChange={(e) => updateLine(line.lineId, { quantity: e.target.value })}
                      aria-label={`Quantity received for ${line.name}`}
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-xs text-gray-500">Cost per {line.packLabel}</span>
                    <input
                      className="input h-11 w-full text-base"
                      inputMode="decimal"
                      value={line.cost}
                      onChange={(e) => updateLine(line.lineId, { cost: e.target.value })}
                      placeholder="Optional"
                      aria-label={`Cost per ${line.packLabel} for ${line.name}`}
                    />
                    {hint && <div className="mt-1 text-xs text-gray-400">{hint}</div>}
                  </label>
                </div>
              </div>
            )
          })}
        </div>

        {skipped.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <span className="mb-1 block text-xs font-medium text-amber-800">
              Not received: {skipped.length} hand-typed item
              {skipped.length === 1 ? '' : 's'}
            </span>
            <p className="text-xs text-amber-700">
              {skipped.join(', ')} went to the supplier on this list, but {skipped.length === 1 ? 'it is' : 'they are'}{' '}
              not in your products, so no stock can move. Add {skipped.length === 1 ? 'it' : 'them'} as a
              product first if you want {skipped.length === 1 ? 'it' : 'them'} counted.
            </p>
          </div>
        )}

        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <span className="mb-2 block text-xs font-medium text-gray-500">
            Supplier&apos;s bill photo (optional, up to {MAX_IMAGES})
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {photos.map((photo) => (
              <div key={photo.id} className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md border border-gray-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.previewUrl} alt="Bill photo" className="h-full w-full object-cover" />
                <IconButton
                  label="Remove photo"
                  variant="danger"
                  onClick={() => removePhoto(photo.id)}
                  className="absolute right-0.5 top-0.5 h-6 w-6 bg-white/90"
                >
                  <X className="h-3.5 w-3.5" />
                </IconButton>
              </div>
            ))}
            {photos.length < MAX_IMAGES && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex h-16 w-16 shrink-0 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-gray-300 text-gray-400 hover:border-gray-400 hover:text-gray-600"
                aria-label="Add bill photo"
              >
                <Camera className="h-5 w-5" />
                <span className="text-[10px]">Add</span>
              </button>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      </div>

      <div className="sticky bottom-0 border-t border-gray-200 bg-white">
        <div className="mx-auto w-full max-w-4xl px-4 py-3">
          <Button className="h-12 w-full text-base" disabled={submitting} onClick={handleSubmit}>
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 motion-safe:animate-spin" /> Receiving...
              </>
            ) : (
              'Receive purchase'
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
