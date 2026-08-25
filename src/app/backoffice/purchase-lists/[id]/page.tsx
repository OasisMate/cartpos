'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Minus, Plus, X, MessageCircle, Printer } from 'lucide-react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import IconButton from '@/components/ui/IconButton'
import Select from '@/components/ui/Select'
import EmptyState from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/ToastProvider'
import { useAuth } from '@/contexts/AuthContext'
import { formatNumber } from '@/lib/utils/money'
import { waUrl } from '@/lib/utils/whatsapp'
import { buildListShareText } from '@/lib/purchaseLists/shareText'
import PurchaseListPrintModal from '@/components/purchases/PurchaseListPrintModal'

/**
 * The purchase list builder: the screen a shopkeeper uses on the shop floor,
 * one hand on the phone, scanning or searching what is running low.
 */

interface PackagingLevel {
  name: string
  factorToBase: number | string
  level: number
}

interface LineProduct {
  id: string
  name: string
  unit: string
  barcode: string | null
  cartonSize: number | null
  packagingLevels: PackagingLevel[]
}

interface PurchaseListLine {
  id: string
  quantity: number | string
  packName: string | null
  unitsPerItem: number | string
  note: string | null
  product: LineProduct
}

interface SupplierLite {
  id: string
  name: string
  phone: string | null
}

interface PurchaseListDetail {
  id: string
  name: string | null
  status: 'DRAFT' | 'SENT' | 'RECEIVED'
  notes: string | null
  supplierId: string | null
  supplier: SupplierLite | null
  createdAt: string
  lines: PurchaseListLine[]
}

interface ProductHit {
  id: string
  name: string
  unit: string
  barcode: string | null
}

/**
 * One entry in the scan queue: either an already-resolved product (the shopkeeper
 * arrow-selected or clicked it) or a raw scanned/typed term still needing a lookup.
 */
type PendingLookup = { kind: 'resolved'; product: ProductHit } | { kind: 'term'; term: string }

interface PackOption {
  packName: string | null
  unitsPerItem: number
  label: string
}

const BASE_PACK_VALUE = '__base__'

/**
 * Mirrors packOptionsForProduct in src/lib/domain/purchaseLists.ts. Kept as a
 * separate, pure copy here because that module pulls in Prisma and cannot be
 * imported into a client bundle. Packaging levels larger than 1, descending,
 * then the legacy carton (only if no level already covers that size), then
 * the base unit last.
 */
function packOptionsForProduct(product: {
  unit: string
  cartonSize?: number | null
  packagingLevels?: PackagingLevel[]
}): PackOption[] {
  const options: PackOption[] = []

  for (const level of product.packagingLevels ?? []) {
    const factor = Number(level.factorToBase)
    if (!Number.isFinite(factor) || factor <= 1) continue
    options.push({ packName: level.name, unitsPerItem: factor, label: level.name })
  }
  options.sort((a, b) => b.unitsPerItem - a.unitsPerItem)

  const cartonSize = product.cartonSize ?? 0
  if (cartonSize > 1 && !options.some((o) => o.unitsPerItem === cartonSize)) {
    options.push({ packName: 'Carton', unitsPerItem: cartonSize, label: 'Carton' })
    options.sort((a, b) => b.unitsPerItem - a.unitsPerItem)
  }

  options.push({ packName: null, unitsPerItem: 1, label: product.unit })
  return options
}

function LineRow({
  index,
  line,
  onQuantityChange,
  onPackChange,
  onRemove,
}: {
  index: number
  line: PurchaseListLine
  onQuantityChange: (lineId: string, quantity: number) => Promise<boolean>
  onPackChange: (lineId: string, packName: string | null) => Promise<boolean>
  onRemove: (lineId: string) => Promise<boolean>
}) {
  const quantity = Number(line.quantity)
  const unitsPerItem = Number(line.unitsPerItem)
  const [draft, setDraft] = useState(String(quantity))
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)

  useEffect(() => {
    setDraft(String(quantity))
  }, [quantity])

  const options = packOptionsForProduct(line.product)
  const baseEquivalent = unitsPerItem > 1 ? quantity * unitsPerItem : null

  async function commitQuantity(next: number) {
    if (!Number.isFinite(next) || next <= 0) {
      setDraft(String(quantity))
      return
    }
    if (next === quantity) return
    setSaving(true)
    const ok = await onQuantityChange(line.id, next)
    setSaving(false)
    if (!ok) setDraft(String(quantity))
  }

  async function handlePackChange(value: string) {
    const packName = value === BASE_PACK_VALUE ? null : value
    if (packName === line.packName) return
    setSaving(true)
    await onPackChange(line.id, packName)
    setSaving(false)
  }

  async function handleRemove() {
    setRemoving(true)
    const ok = await onRemove(line.id)
    if (!ok) setRemoving(false)
  }

  const busy = saving || removing

  return (
    <div className="flex items-center gap-3 py-3">
      <div className="w-5 shrink-0 text-xs text-gray-400">{index + 1}</div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-gray-900">{line.product.name}</div>
        {line.product.barcode && (
          <div className="truncate text-xs text-gray-400">{line.product.barcode}</div>
        )}
      </div>

      <Select
        className="h-8 w-24 shrink-0 text-sm"
        value={line.packName ?? BASE_PACK_VALUE}
        disabled={busy}
        onChange={(e) => handlePackChange(e.target.value)}
        aria-label={`Unit for ${line.product.name}`}
      >
        {options.map((o) => (
          <option key={o.packName ?? BASE_PACK_VALUE} value={o.packName ?? BASE_PACK_VALUE}>
            {o.label}
          </option>
        ))}
      </Select>

      <div className="flex shrink-0 flex-col items-end">
        <div className="flex items-center gap-1">
          <IconButton
            label="Decrease quantity"
            disabled={busy || quantity <= 1}
            onClick={() => commitQuantity(quantity - 1)}
          >
            <Minus className="h-4 w-4" />
          </IconButton>
          <input
            className="input h-8 w-14 px-1 text-center"
            inputMode="decimal"
            value={draft}
            disabled={busy}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => commitQuantity(Number(draft))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                ;(e.target as HTMLInputElement).blur()
              }
            }}
            aria-label={`Quantity for ${line.product.name}`}
          />
          <IconButton
            label="Increase quantity"
            disabled={busy}
            onClick={() => commitQuantity(quantity + 1)}
          >
            <Plus className="h-4 w-4" />
          </IconButton>
        </div>
        {baseEquivalent !== null && (
          <div className="mt-0.5 text-xs text-gray-400">
            = {formatNumber(baseEquivalent)} {line.product.unit}
          </div>
        )}
      </div>

      <IconButton label="Remove item" variant="danger" disabled={busy} onClick={handleRemove}>
        <X className="h-4 w-4" />
      </IconButton>
    </div>
  )
}

export default function PurchaseListBuilderPage({ params }: { params: { id: string } }) {
  const listId = params.id
  const { show } = useToast()
  const { user } = useAuth()

  const [list, setList] = useState<PurchaseListDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [suppliers, setSuppliers] = useState<SupplierLite[]>([])

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ProductHit[]>([])
  const [highlightIndex, setHighlightIndex] = useState(-1)
  const [showPrint, setShowPrint] = useState(false)

  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState('')

  const searchRef = useRef<HTMLInputElement>(null)
  const searchReqIdRef = useRef(0)
  // The pending 200ms debounce timer, reachable from the Enter handler so a scan
  // can cancel it outright instead of racing it (see handleSearchKeyDown).
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // A scanner is a firehose: every Enter must be accepted, never dropped. Enter
  // captures and clears the box synchronously, then pushes onto this FIFO queue;
  // one drain loop works through it in order so a slow lookup can never make a
  // later scan's Enter get lost or double up with an earlier one.
  const pendingLookupsRef = useRef<PendingLookup[]>([])
  const draining = useRef(false)

  const loadList = useCallback(async () => {
    try {
      const res = await fetch(`/api/purchase-lists/${listId}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load list')
      setList(data)
      setNameDraft(data.name || '')
      setLoadError('')
    } catch (err: any) {
      setLoadError(err.message || 'Failed to load list')
    } finally {
      setLoading(false)
    }
  }, [listId])

  useEffect(() => {
    loadList()
  }, [loadList])

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

  // The scan box stays reachable: focus it once the list has loaded. Deliberately
  // keyed on the id only, not the whole list object, so a quantity/pack edit
  // elsewhere on the page never steals focus back from what the shopkeeper is doing.
  useEffect(() => {
    if (list) searchRef.current?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list?.id])

  // Shared product lookup. Bumps the one monotonic request id so a slower/older
  // call (debounced or direct) can never overwrite a newer one's result.
  async function searchProducts(term: string): Promise<{ reqId: number; products: ProductHit[] }> {
    const reqId = ++searchReqIdRef.current
    const res = await fetch(`/api/products?search=${encodeURIComponent(term)}&limit=20`)
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Search failed')
    return { reqId, products: data.products || [] }
  }

  // Debounced product search, 200ms, for the dropdown shown while typing a name.
  // The highlight resets on every keystroke (a stale arrow-selection must never
  // survive into a different query), synchronously, not only once the fetch lands.
  useEffect(() => {
    const term = query.trim()
    setHighlightIndex(-1)
    if (!term) {
      setResults([])
      return
    }
    searchTimerRef.current = setTimeout(async () => {
      try {
        const { reqId, products } = await searchProducts(term)
        if (reqId !== searchReqIdRef.current) return
        setResults(products)
      } catch {
        // Transient search failure while typing: leave the previous results showing.
      }
    }, 200)
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    }
  }, [query])

  function mergeLine(line: PurchaseListLine) {
    setList((current) => {
      if (!current) return current
      const exists = current.lines.some((l) => l.id === line.id)
      const lines = exists
        ? current.lines.map((l) => (l.id === line.id ? line : l))
        : [...current.lines, line]
      return { ...current, lines }
    })
  }

  // Adds one already-resolved product. Never touches the search box: by the time
  // this runs the box may already belong to a different, later scan (see the
  // queue below), so only the caller that captured a given term is allowed to
  // clear it, and only at capture time, not once this settles.
  async function addResolvedProduct(product: ProductHit) {
    try {
      const res = await fetch(`/api/purchase-lists/${listId}/lines`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: product.id, quantity: 1 }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to add item')
      mergeLine(data)
    } catch (err: any) {
      show({ message: err.message || `Failed to add ${product.name}`, variant: 'destructive' })
    }
  }

  // Resolves a scanned/typed term to a product and adds it. Always ends in one
  // visible outcome: added, or a toast naming the term that failed - never silent.
  async function resolveAndAddTerm(term: string) {
    try {
      const { products } = await searchProducts(term)
      const exact = products.find((p) => p.barcode === term)
      if (exact) {
        await addResolvedProduct(exact)
        return
      }
      // Zero matches, or several with no exact barcode: a queued scan has no
      // shopkeeper standing by to arrow-pick from a dropdown, so anything short
      // of one clean match is reported the same way, naming what was scanned.
      show({ message: `No product found for "${term}"`, variant: 'destructive' })
    } catch (err: any) {
      show({ message: err.message || `Search failed for "${term}"`, variant: 'destructive' })
    }
  }

  // FIFO queue: Enter pushes here and returns immediately (see handleSearchKeyDown).
  // If a drain is already running it will pick up the new entry on its next loop
  // iteration, since pendingLookupsRef is the same shared array; only one drain
  // loop is ever active, so lookups are always processed one at a time, in order.
  function enqueueLookup(item: PendingLookup) {
    pendingLookupsRef.current.push(item)
    void drainLookupQueue()
  }

  // Same capture-then-clear-then-queue shape as the Enter/highlighted-row path,
  // for a mouse/tap pick from the dropdown.
  function handleResultClick(product: ProductHit) {
    setQuery('')
    setResults([])
    setHighlightIndex(-1)
    enqueueLookup({ kind: 'resolved', product })
  }

  async function drainLookupQueue() {
    if (draining.current) return
    draining.current = true
    try {
      while (pendingLookupsRef.current.length > 0) {
        const item = pendingLookupsRef.current.shift()!
        if (item.kind === 'resolved') {
          await addResolvedProduct(item.product)
        } else {
          await resolveAndAddTerm(item.term)
        }
      }
    } finally {
      draining.current = false
    }
  }

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightIndex((i) => Math.min(i + 1, results.length - 1))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightIndex((i) => Math.max(i - 1, -1))
      return
    }
    if (e.key === 'Escape') {
      setQuery('')
      setResults([])
      setHighlightIndex(-1)
      return
    }
    if (e.key !== 'Enter') return
    e.preventDefault()

    // Capture and clear the box synchronously, in this same tick, before any
    // await runs anywhere: a scanner is a firehose, and the box must belong to
    // the NEXT scan the instant this one is queued, never mingling leftover
    // characters between the two. Cancel any pending debounce for what is being
    // replaced, since its eventual response is no longer for what's on screen.
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)

    // A row already highlighted by the arrow keys always wins, no network needed.
    if (highlightIndex >= 0 && results[highlightIndex]) {
      const product = results[highlightIndex]
      setQuery('')
      setResults([])
      setHighlightIndex(-1)
      searchRef.current?.focus()
      enqueueLookup({ kind: 'resolved', product })
      return
    }

    const term = query.trim()
    if (!term) return

    setQuery('')
    setResults([])
    setHighlightIndex(-1)
    searchRef.current?.focus()
    enqueueLookup({ kind: 'term', term })
  }

  async function updateQuantity(lineId: string, quantity: number): Promise<boolean> {
    try {
      const res = await fetch(`/api/purchase-lists/lines/${lineId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update quantity')
      mergeLine(data)
      return true
    } catch (err: any) {
      show({ message: err.message || 'Failed to update quantity', variant: 'destructive' })
      return false
    }
  }

  async function changePack(lineId: string, packName: string | null): Promise<boolean> {
    try {
      const res = await fetch(`/api/purchase-lists/lines/${lineId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packName }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update unit')
      mergeLine(data)
      return true
    } catch (err: any) {
      show({ message: err.message || 'Failed to update unit', variant: 'destructive' })
      return false
    }
  }

  async function removeLine(lineId: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/purchase-lists/lines/${lineId}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to remove item')
      }
      setList((current) =>
        current ? { ...current, lines: current.lines.filter((l) => l.id !== lineId) } : current
      )
      return true
    } catch (err: any) {
      show({ message: err.message || 'Failed to remove item', variant: 'destructive' })
      return false
    }
  }

  async function saveName() {
    setEditingName(false)
    if (!list) return
    const trimmed = nameDraft.trim()
    if (trimmed === (list.name || '')) return
    try {
      const res = await fetch(`/api/purchase-lists/${listId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to rename list')
      setList((current) => (current ? { ...current, name: data.name } : current))
    } catch (err: any) {
      setNameDraft(list.name || '')
      show({ message: err.message || 'Failed to rename list', variant: 'destructive' })
    }
  }

  async function changeSupplier(supplierId: string) {
    if (!list) return
    try {
      const res = await fetch(`/api/purchase-lists/${listId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supplierId: supplierId || null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update supplier')
      const supplier = suppliers.find((s) => s.id === supplierId) || null
      setList((current) => (current ? { ...current, supplierId: data.supplierId, supplier } : current))
    } catch (err: any) {
      show({ message: err.message || 'Failed to update supplier', variant: 'destructive' })
    }
  }

  function handleShare() {
    if (!list) return
    const shopName = user?.shops?.find((s) => s.shopId === user.currentShopId)?.shop.name
    const text = buildListShareText({
      shopName: shopName || 'Shop',
      listName: list.name,
      supplierName: list.supplier?.name,
      date: new Date(list.createdAt),
      lines: list.lines.map((l) => ({
        name: l.product.name,
        quantity: Number(l.quantity),
        unit: l.packName || l.product.unit,
      })),
    })
    window.open(waUrl(list.supplier?.phone, text), '_blank', 'noopener,noreferrer')
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

  const currentShop = user?.shops?.find((s) => s.shopId === user.currentShopId)?.shop

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="sticky top-0 z-10 space-y-2 border-b border-gray-200 bg-white px-4 py-3">
        <div className="flex items-center gap-2">
          <Link
            href="/store/purchase-lists"
            className="shrink-0 text-gray-500 hover:text-gray-700"
            aria-label="Back to purchase lists"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          {editingName ? (
            <input
              autoFocus
              className="input h-9 min-w-0 flex-1 font-semibold"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={saveName}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  ;(e.target as HTMLInputElement).blur()
                } else if (e.key === 'Escape') {
                  setNameDraft(list.name || '')
                  setEditingName(false)
                }
              }}
            />
          ) : (
            <button
              type="button"
              className="min-w-0 flex-1 truncate text-left font-semibold text-gray-900"
              onClick={() => setEditingName(true)}
            >
              {list.name || 'Untitled list'}
            </button>
          )}
          <Select
            className="h-9 w-36 shrink-0 text-sm"
            value={list.supplierId || ''}
            onChange={(e) => changeSupplier(e.target.value)}
            aria-label="Supplier"
          >
            <option value="">No supplier</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="relative">
          <Input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Scan barcode or search by name"
            className="h-11 w-full text-base"
            autoFocus
            role="combobox"
            aria-expanded={results.length > 0}
            aria-controls="purchase-list-search-results"
            aria-activedescendant={highlightIndex >= 0 ? `purchase-list-opt-${highlightIndex}` : undefined}
          />
          {results.length > 0 && (
            <div
              id="purchase-list-search-results"
              role="listbox"
              className="absolute left-0 right-0 z-20 mt-1 max-h-72 overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg"
            >
              {results.map((r, i) => (
                <button
                  key={r.id}
                  id={`purchase-list-opt-${i}`}
                  role="option"
                  aria-selected={i === highlightIndex}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleResultClick(r)}
                  className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm ${
                    i === highlightIndex ? 'bg-blue-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <span className="truncate">{r.name}</span>
                  {r.barcode && <span className="ml-2 shrink-0 text-xs text-gray-400">{r.barcode}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="px-4 py-3">
        {list.lines.length === 0 ? (
          <EmptyState title="Nothing on this list yet. Scan an item or search for it." />
        ) : (
          <div className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white px-3">
            {list.lines.map((line, i) => (
              <LineRow
                key={line.id}
                index={i}
                line={line}
                onQuantityChange={updateQuantity}
                onPackChange={changePack}
                onRemove={removeLine}
              />
            ))}
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 flex items-center gap-2 border-t border-gray-200 bg-white px-4 py-3">
        <div className="mr-auto text-sm text-gray-500">
          {list.lines.length} item{list.lines.length === 1 ? '' : 's'}
        </div>
        <Button variant="outline" size="sm" onClick={handleShare} disabled={list.lines.length === 0}>
          <MessageCircle className="mr-1 h-4 w-4" /> Share
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowPrint(true)}
          disabled={list.lines.length === 0}
        >
          <Printer className="mr-1 h-4 w-4" /> Print
        </Button>
        <div className="flex flex-col items-center gap-0.5">
          <Button size="sm" disabled title="Coming in the next step">
            Receive
          </Button>
          <span className="text-[10px] leading-none text-gray-400">Coming in the next step</span>
        </div>
      </div>

      <PurchaseListPrintModal
        isOpen={showPrint}
        onClose={() => setShowPrint(false)}
        shop={{
          name: currentShop?.name,
          city: currentShop?.city,
          phone: currentShop?.phone,
        }}
        list={{
          name: list.name,
          supplierName: list.supplier?.name,
          createdAt: new Date(list.createdAt),
          notes: list.notes,
          lines: list.lines.map((l) => ({
            name: l.product.name,
            quantity: Number(l.quantity),
            unit: l.packName || l.product.unit,
          })),
        }}
      />
    </div>
  )
}
