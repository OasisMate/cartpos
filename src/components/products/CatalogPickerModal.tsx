'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { Search, Check, Loader2 } from 'lucide-react'

interface CatalogItem {
  id: string
  barcode: string
  name: string
  unit: string
  category: string | null
  suggestedPrice: string | null
  alreadyAdded: boolean
}

interface CategoryOption {
  category: string
  count: number
}

/**
 * Browse the shared catalog and add items to this shop.
 *
 * The shopkeeper's ordering problem is "what do I stock?", not "what did I
 * search for", so browsing by category comes first and search is the shortcut.
 *
 * Selections and edited prices live in a Map keyed by catalog id, deliberately
 * outside the fetched page: someone can tick items in Biscuits, jump to
 * Beverages, tick more, and add all of it in one go without losing anything.
 */
export default function CatalogPickerModal({
  open,
  onClose,
  onDone,
}: {
  open: boolean
  onClose: () => void
  onDone: () => void
}) {
  const [items, setItems] = useState<CatalogItem[]>([])
  const [categories, setCategories] = useState<CategoryOption[]>([])
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [category, setCategory] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [picked, setPicked] = useState<Map<string, { name: string; price: string }>>(new Map())
  // Adding a whole category is one click away from adding the wrong one, so it
  // asks first. Bulk adds are tedious to undo by hand.
  const [confirmAll, setConfirmAll] = useState(false)

  // Guards against a slow earlier response overwriting a newer one.
  const reqIdRef = useRef(0)

  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [search])

  const fetchItems = useCallback(async () => {
    const reqId = ++reqIdRef.current
    setLoading(true)
    try {
      const q = new URLSearchParams({ page: String(page), limit: '50' })
      if (debounced) q.set('search', debounced)
      if (category) q.set('category', category)
      const res = await fetch(`/api/catalog?${q}`)
      const data = await res.json()
      if (reqId !== reqIdRef.current) return
      if (!res.ok) throw new Error(data?.error || 'Failed to load catalog')
      setItems(data.items ?? [])
      setTotalPages(data.pagination?.totalPages ?? 1)
      setTotal(data.pagination?.total ?? 0)
      setError('')
    } catch (e: any) {
      if (reqId === reqIdRef.current) setError(e?.message || 'Failed to load catalog')
    } finally {
      if (reqId === reqIdRef.current) setLoading(false)
    }
  }, [page, debounced, category])

  useEffect(() => {
    if (open) fetchItems()
  }, [open, fetchItems])

  useEffect(() => {
    if (!open) return
    fetch('/api/catalog/categories')
      .then((r) => r.json())
      .then((d) => setCategories(d?.categories ?? []))
      .catch(() => {})
  }, [open])

  // Reset everything on close, so reopening is a clean start rather than a
  // half-remembered basket from last time.
  useEffect(() => {
    if (!open) {
      setPicked(new Map())
      setSearch('')
      setCategory(null)
      setPage(1)
      setError('')
      setConfirmAll(false)
    }
  }, [open])

  function toggle(item: CatalogItem) {
    if (item.alreadyAdded) return
    setPicked((prev) => {
      const next = new Map(prev)
      if (next.has(item.id)) next.delete(item.id)
      else next.set(item.id, { name: item.name, price: item.suggestedPrice ?? '' })
      return next
    })
  }

  function setPrice(id: string, price: string) {
    setPicked((prev) => {
      const next = new Map(prev)
      const entry = next.get(id)
      if (entry) next.set(id, { ...entry, price })
      return next
    })
  }

  function selectAllOnPage() {
    setPicked((prev) => {
      const next = new Map(prev)
      for (const item of items) {
        if (item.alreadyAdded || next.has(item.id)) continue
        next.set(item.id, { name: item.name, price: item.suggestedPrice ?? '' })
      }
      return next
    })
  }

  const missingPrice = [...picked.values()].filter((p) => !String(p.price).trim()).length
  const filterLabel = category ? `in ${category}` : debounced ? `matching "${debounced}"` : ''

  /**
   * Add everything matching the current filter. A shop stocking the usual range
   * wants the whole catalog, and ticking 1,965 boxes across 40 pages is not a
   * feature. Sends the filter, not the ids, and prices come from the catalog.
   */
  async function handleAddAll() {
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/catalog/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true, search: debounced || null, category }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to add products')
      onDone()
      onClose()
    } catch (e: any) {
      setError(e?.message || 'Failed to add products')
    } finally {
      setSaving(false)
      setConfirmAll(false)
    }
  }

  async function handleAdd() {
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/catalog/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          picks: [...picked.entries()].map(([id, v]) => ({ id, price: v.price })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to add products')
      onDone()
      onClose()
    } catch (e: any) {
      setError(e?.message || 'Failed to add products')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add products from catalog" size="xl">
      <div className="space-y-3">
        <div className="text-sm text-[hsl(var(--muted-foreground))]">
          Tick what you stock and set your price, or add a whole category at once. Prices shown are
          typical retail. You can change them any time.
        </div>

        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            type="text"
            placeholder="Search by name or barcode..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {categories.length > 0 && (
          // One scrollable row on a phone, wrapped rows on a desktop. Wrapping
          // 21 chips on a 390px screen ate 310px of an 844px viewport and left
          // room for four products.
          <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 sm:flex-wrap sm:overflow-x-visible sm:mx-0 sm:px-0">
            <button
              type="button"
              onClick={() => { setCategory(null); setPage(1) }}
              className={`shrink-0 whitespace-nowrap px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                category === null
                  ? 'bg-orange-600 text-white border-orange-600'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              All
            </button>
            {categories.map((c) => (
              <button
                key={c.category}
                type="button"
                onClick={() => { setCategory(c.category); setPage(1) }}
                className={`shrink-0 whitespace-nowrap px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                  category === c.category
                    ? 'bg-orange-600 text-white border-orange-600'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {c.category} <span className="opacity-60">{c.count}</span>
              </button>
            ))}
          </div>
        )}

        {error && <div className="p-3 bg-red-100 text-red-700 rounded text-sm">{error}</div>}

        <div className="flex items-center justify-between text-xs text-[hsl(var(--muted-foreground))]">
          <span>{total} items{category ? ` in ${category}` : ''}</span>
          <button type="button" onClick={selectAllOnPage} className="font-medium text-orange-600 hover:underline">
            Select all on this page
          </button>
        </div>

        <div className="border rounded-md divide-y max-h-[50vh] sm:max-h-[45vh] overflow-y-auto">
          {loading ? (
            <div className="py-10 text-center text-sm text-[hsl(var(--muted-foreground))]">
              <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
              Loading catalog...
            </div>
          ) : items.length === 0 ? (
            <div className="py-10 text-center text-sm text-[hsl(var(--muted-foreground))]">
              {debounced || category
                ? 'Nothing matches. Try a different search or category.'
                : 'The catalog is empty for this shop type.'}
            </div>
          ) : (
            items.map((item) => {
              const sel = picked.get(item.id)
              return (
                <div
                  key={item.id}
                  className={`flex items-center gap-3 px-3 py-2 ${
                    item.alreadyAdded ? 'opacity-50' : 'hover:bg-gray-50 cursor-pointer'
                  }`}
                  onClick={() => toggle(item)}
                >
                  <div
                    className={`w-4 h-4 shrink-0 rounded border flex items-center justify-center ${
                      sel ? 'bg-orange-600 border-orange-600' : 'border-gray-300'
                    }`}
                  >
                    {sel && <Check className="w-3 h-3 text-white" />}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{item.name}</div>
                    <div className="text-xs text-[hsl(var(--muted-foreground))]">
                      {item.barcode} · {item.unit}
                      {item.category ? ` · ${item.category}` : ''}
                      {item.alreadyAdded ? ' · already added' : ''}
                    </div>
                  </div>

                  {sel && (
                    <div onClick={(e) => e.stopPropagation()} className="shrink-0">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={sel.price}
                        onChange={(e) => setPrice(item.id, e.target.value)}
                        placeholder="Price"
                        className="w-24 h-8 text-sm"
                      />
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* Paging lives inside the sticky bar. Left below it, the pinned footer
            covered it completely on a phone and Next became unreachable. */}
        <div className="sticky bottom-0 -mx-6 -mb-6 px-6 py-3 bg-white border-t space-y-3">
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm">
              <Button variant="outline" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <span className="text-[hsl(var(--muted-foreground))]">
                Page {page} of {totalPages}
              </span>
              <Button variant="outline" disabled={page >= totalPages || loading} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {confirmAll ? (
            <>
              <div className="text-sm">
                Add all <span className="font-semibold">{total}</span> products {filterLabel} at the
                suggested prices? You can change prices afterwards.
              </div>
              <div className="flex gap-2 shrink-0">
                <Button variant="outline" onClick={() => setConfirmAll(false)} disabled={saving}>
                  Back
                </Button>
                <Button onClick={handleAddAll} disabled={saving}>
                  {saving ? 'Adding...' : `Yes, add ${total}`}
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="text-sm">
                {picked.size > 0 ? (
                  <>
                    <span className="font-semibold">{picked.size}</span> selected
                    {missingPrice > 0 && (
                      <span className="text-amber-600"> · {missingPrice} without a price</span>
                    )}
                  </>
                ) : (
                  <span className="text-[hsl(var(--muted-foreground))]">Nothing selected yet</span>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <Button variant="outline" onClick={onClose} disabled={saving}>
                  Cancel
                </Button>
                {picked.size === 0 && total > 0 && (
                  <Button variant="outline" onClick={() => setConfirmAll(true)} disabled={saving || loading}>
                    Add all {total}
                  </Button>
                )}
                {picked.size > 0 && (
                  <Button onClick={handleAdd} disabled={saving}>
                    {saving ? 'Adding...' : `Add ${picked.size} product${picked.size === 1 ? '' : 's'}`}
                  </Button>
                )}
              </div>
            </>
          )}
          </div>
        </div>
      </div>
    </Modal>
  )
}
