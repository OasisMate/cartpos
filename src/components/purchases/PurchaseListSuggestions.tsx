'use client'

import { useEffect, useState } from 'react'
import { ChevronDown, Plus } from 'lucide-react'
import { useToast } from '@/components/ui/ToastProvider'
import { formatNumber } from '@/lib/utils/money'

/**
 * The "Suggested" panel under the purchase list builder: what the shop probably
 * needs to reorder, so the shopkeeper does not have to remember everything.
 * Most shops here run with stock tracking off and a new shop has no sales yet,
 * so an empty panel is the normal first experience, not an edge case.
 */

interface Suggestion {
  productId: string
  name: string
  unit: string
  barcode: string | null
  reason: 'LOW_STOCK' | 'SOLD_RECENTLY'
  shortfall?: number
  baseUnitsSold?: number
}

export default function PurchaseListSuggestions({
  listId,
  onAdded,
  refreshSignal,
}: {
  listId: string
  // Whatever shape POST /api/purchase-lists/{listId}/lines returns, passed straight
  // through to the caller (the builder merges it into its own line list).
  onAdded: (line: any) => void
  // Bumped by the builder whenever a line is added by any means. A tap on a row
  // here already removes it locally, but a product added via the scan box or
  // search never touches this panel, so without this it keeps showing a
  // suggestion for something already on the list. Any change re-fetches, which
  // naturally drops it since the suggestions query excludes what's on the list.
  refreshSignal?: number
}) {
  const { show } = useToast()
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(true)
  // Collapsed by default: this is a phone-first screen and the panel sits below
  // the lines the shopkeeper is actively working on.
  const [expanded, setExpanded] = useState(false)
  const [addingId, setAddingId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/purchase-lists/suggestions?listId=${listId}&days=30&limit=50`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to load suggestions')
        if (!cancelled) setSuggestions(data.suggestions || [])
      } catch (err: any) {
        if (!cancelled) {
          show({ message: err.message || 'Failed to load suggestions', variant: 'destructive' })
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [listId, show, refreshSignal])

  // Adds one of the product's largest pack: quantity 1, no pack specified, the
  // server defaults an unspecified pack to the product's largest. The shop buys
  // in packs, not loose pieces.
  async function handleAdd(suggestion: Suggestion) {
    setAddingId(suggestion.productId)
    try {
      const res = await fetch(`/api/purchase-lists/${listId}/lines`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: suggestion.productId, quantity: 1 }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Failed to add ${suggestion.name}`)
      setSuggestions((current) => current.filter((s) => s.productId !== suggestion.productId))
      onAdded(data)
    } catch (err: any) {
      show({ message: err.message || `Failed to add ${suggestion.name}`, variant: 'destructive' })
    } finally {
      setAddingId(null)
    }
  }

  // Nothing to render until the first fetch settles: no point flashing a header
  // that might immediately need to change count.
  if (loading) return null

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <button
        type="button"
        className="flex w-full items-center justify-between px-4 py-3 text-left"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
      >
        <span className="text-sm font-semibold text-gray-900">
          Suggested{suggestions.length > 0 ? ` (${suggestions.length})` : ''}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-gray-500 transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {expanded && (
        <div className="border-t border-gray-100 px-4 py-2">
          {suggestions.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-500">
              No suggestions yet. They appear once you have some sales, or once you turn on stock
              tracking for a product.
            </p>
          ) : (
            <div className="divide-y divide-gray-100">
              {suggestions.map((s) => (
                <button
                  key={s.productId}
                  type="button"
                  disabled={addingId === s.productId}
                  onClick={() => handleAdd(s)}
                  className="flex w-full items-center gap-3 py-3 text-left disabled:opacity-50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-gray-900">{s.name}</div>
                  </div>

                  {s.reason === 'LOW_STOCK' ? (
                    <div className="flex shrink-0 flex-col items-end gap-0.5">
                      <span className="rounded-full border border-amber-100 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                        Low
                      </span>
                      <span className="text-[11px] text-gray-500">
                        {formatNumber(s.shortfall)} below reorder level
                      </span>
                    </div>
                  ) : (
                    <span className="shrink-0 rounded-full border border-gray-200 bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
                      sold {formatNumber(s.baseUnitsSold)} in 30d
                    </span>
                  )}

                  <Plus className="h-4 w-4 shrink-0 text-gray-400" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
