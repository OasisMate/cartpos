'use client'

import { useState, useEffect, useCallback } from 'react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { formatCurrency } from '@/lib/utils/money'
import { BrandSpinner } from '@/components/ui/BrandSpinner'
import { X } from 'lucide-react'

interface ReturnableLine {
  productId: string
  name: string
  unit: string
  unitPrice: number
  sold: number
  alreadyReturned: number
  returnable: number
}
interface ReturnableInvoice {
  invoiceId: string
  number: string | null
  paymentStatus: string
  customerId: string | null
  customerName: string | null
  lines: ReturnableLine[]
}
interface ReplacementItem {
  productId: string
  name: string
  unit: string
  price: number
  qty: number
}

export default function ReturnModal({
  saleId,
  isOpen,
  onClose,
  onDone,
}: {
  saleId: string
  isOpen: boolean
  onClose: () => void
  onDone: () => void
}) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [data, setData] = useState<ReturnableInvoice | null>(null)
  const [qty, setQty] = useState<Record<string, string>>({})
  const [damaged, setDamaged] = useState<Record<string, boolean>>({})
  const [replacements, setReplacements] = useState<ReplacementItem[]>([])
  const [settlement, setSettlement] = useState<'CASH' | 'ACCOUNT_CREDIT'>('CASH')
  const [submitting, setSubmitting] = useState(false)
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<Array<{ id: string; name: string; unit: string; price: number }>>([])

  useEffect(() => {
    if (!isOpen) return
    setLoading(true)
    setError('')
    setData(null)
    setQty({})
    setDamaged({})
    setReplacements([])
    setSettlement('CASH')
    fetch(`/api/sales/${saleId}/returnable`)
      .then(async (r) => {
        const d = await r.json()
        if (!r.ok) throw new Error(d.error || 'Failed to load sale')
        setData(d.invoice)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [isOpen, saleId])

  // Debounced product search for exchange replacements.
  useEffect(() => {
    if (!search.trim()) {
      setResults([])
      return
    }
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/products?search=${encodeURIComponent(search)}&limit=8`)
        const d = await r.json()
        setResults((d.products || []).map((p: any) => ({ id: p.id, name: p.name, unit: p.unit, price: Number(p.price) })))
      } catch {
        setResults([])
      }
    }, 300)
    return () => clearTimeout(t)
  }, [search])

  const returnValue = (data?.lines || []).reduce((s, l) => {
    const q = parseFloat(qty[l.productId] || '0') || 0
    return s + q * l.unitPrice
  }, 0)
  const replacementValue = replacements.reduce((s, r) => s + r.qty * r.price, 0)
  const net = Math.round((returnValue - replacementValue) * 100) / 100
  const isExchange = replacements.length > 0

  function addReplacement(p: { id: string; name: string; unit: string; price: number }) {
    setReplacements((prev) =>
      prev.some((r) => r.productId === p.id)
        ? prev.map((r) => (r.productId === p.id ? { ...r, qty: r.qty + 1 } : r))
        : [...prev, { productId: p.id, name: p.name, unit: p.unit, price: p.price, qty: 1 }]
    )
    setSearch('')
    setResults([])
  }

  const submit = useCallback(async () => {
    if (submitting || !data) return
    const returnLines = (data.lines || [])
      .map((l) => ({ productId: l.productId, quantity: parseFloat(qty[l.productId] || '0') || 0, damaged: !!damaged[l.productId] }))
      .filter((l) => l.quantity > 0)
    if (!returnLines.length && !replacements.length) {
      setError('Select at least one item to return')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const resp = await fetch('/api/returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId: saleId,
          returnLines,
          replacementLines: replacements.map((r) => ({ productId: r.productId, quantity: r.qty })),
          settlement,
        }),
      })
      const d = await resp.json()
      if (!resp.ok) throw new Error(d.error || 'Failed to process return')
      onDone()
      onClose()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }, [submitting, data, qty, damaged, replacements, settlement, saleId, onDone, onClose])

  const accountDisabled = !data?.customerId

  return (
    <Modal open={isOpen} onClose={() => !submitting && onClose()} title="Return / Refund / Exchange">
      {loading ? (
        <div className="flex justify-center py-10">
          <BrandSpinner size={40} />
        </div>
      ) : error && !data ? (
        <div className="p-3 bg-red-50 text-red-700 rounded text-sm">{error}</div>
      ) : data ? (
        <div className="space-y-4">
          <div className="text-sm text-gray-600">
            Invoice #{data.number || saleId.slice(0, 8)}
            {data.customerName ? ` · ${data.customerName}` : ' · Walk-in'}
          </div>

          {/* Items to return */}
          <div>
            <h3 className="font-semibold mb-2 text-sm">Items to return</h3>
            <div className="space-y-2">
              {data.lines.map((l) => (
                <div key={l.productId} className="flex items-center gap-2 text-sm border-b border-gray-100 pb-2">
                  <div className="flex-1 min-w-0">
                    <div className="truncate font-medium">{l.name}</div>
                    <div className="text-xs text-gray-500">
                      {formatCurrency(l.unitPrice)} · sold {l.sold}
                      {l.alreadyReturned > 0 ? ` · returned ${l.alreadyReturned}` : ''} · max {l.returnable}
                    </div>
                  </div>
                  <input
                    type="number"
                    min={0}
                    max={l.returnable}
                    step="0.001"
                    value={qty[l.productId] || ''}
                    onChange={(e) => setQty((q) => ({ ...q, [l.productId]: e.target.value }))}
                    disabled={l.returnable <= 0}
                    placeholder="0"
                    className="input h-8 w-20 text-center"
                  />
                  <label className="flex items-center gap-1 text-xs text-gray-600 w-20">
                    <input
                      type="checkbox"
                      checked={!!damaged[l.productId]}
                      onChange={(e) => setDamaged((d) => ({ ...d, [l.productId]: e.target.checked }))}
                    />
                    damaged
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Exchange replacements */}
          <div>
            <h3 className="font-semibold mb-2 text-sm">Exchange for new items (optional)</h3>
            {replacements.length > 0 && (
              <div className="space-y-2 mb-2">
                {replacements.map((r) => (
                  <div key={r.productId} className="flex items-center gap-2 text-sm">
                    <span className="flex-1 truncate">{r.name}</span>
                    <span className="text-xs text-gray-500">{formatCurrency(r.price)}</span>
                    <input
                      type="number"
                      min={0}
                      step="0.001"
                      value={r.qty}
                      onChange={(e) =>
                        setReplacements((prev) =>
                          prev.map((x) => (x.productId === r.productId ? { ...x, qty: parseFloat(e.target.value) || 0 } : x))
                        )
                      }
                      className="input h-8 w-20 text-center"
                    />
                    <button
                      onClick={() => setReplacements((prev) => prev.filter((x) => x.productId !== r.productId))}
                      className="text-gray-400 hover:text-red-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search product to add..."
              className="input h-8 w-full text-sm"
            />
            {results.length > 0 && (
              <div className="mt-1 border border-gray-200 rounded max-h-40 overflow-y-auto">
                {results.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => addReplacement(p)}
                    className="flex w-full items-center justify-between px-3 py-1.5 text-sm hover:bg-gray-50"
                  >
                    <span className="truncate">{p.name}</span>
                    <span className="text-xs text-gray-500">{formatCurrency(p.price)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Settlement */}
          <div className="rounded-lg bg-gray-50 p-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span>Return value</span>
              <span>{formatCurrency(returnValue)}</span>
            </div>
            {isExchange && (
              <div className="flex justify-between text-sm">
                <span>New items</span>
                <span>{formatCurrency(replacementValue)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold border-t border-gray-200 pt-2">
              <span>{net >= 0 ? 'Refund to customer' : 'Customer pays'}</span>
              <span className={net >= 0 ? 'text-emerald-700' : 'text-rose-700'}>{formatCurrency(Math.abs(net))}</span>
            </div>
            {Math.abs(net) > 0.001 && (
              <div className="flex gap-3 pt-1 text-sm">
                <label className="flex items-center gap-1">
                  <input type="radio" checked={settlement === 'CASH'} onChange={() => setSettlement('CASH')} /> Cash
                </label>
                <label className={`flex items-center gap-1 ${accountDisabled ? 'opacity-50' : ''}`}>
                  <input
                    type="radio"
                    checked={settlement === 'ACCOUNT_CREDIT'}
                    disabled={accountDisabled}
                    onChange={() => setSettlement('ACCOUNT_CREDIT')}
                  />
                  Customer account {net >= 0 ? '(credit / store credit)' : '(add to udhaar)'}
                </label>
              </div>
            )}
          </div>

          {error && <div className="p-2 bg-red-50 text-red-700 rounded text-sm">{error}</div>}

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={submit} disabled={submitting}>
              {submitting ? 'Processing...' : 'Confirm return'}
            </Button>
          </div>
        </div>
      ) : null}
    </Modal>
  )
}
