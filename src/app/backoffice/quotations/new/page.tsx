'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { formatCurrency } from '@/lib/utils/money'
import { Trash2, Search } from 'lucide-react'

interface ProductHit {
  id: string
  name: string
  unit: string
  price: number | string
  tradePrice?: number | string | null
}
interface Line {
  productId: string
  name: string
  unit: string
  quantity: number
  unitPrice: number
}
interface CustomerHit {
  id: string
  name: string
  phone: string | null
}

export default function NewQuotationPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [lines, setLines] = useState<Line[]>([])
  const [search, setSearch] = useState('')
  const [hits, setHits] = useState<ProductHit[]>([])
  const [customers, setCustomers] = useState<CustomerHit[]>([])
  const [customerId, setCustomerId] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [discount, setDiscount] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const searchTimer = useRef<any>(null)

  useEffect(() => {
    if (!user?.currentShopId) return
    fetch('/api/customers')
      .then((r) => r.json())
      .then((d) => setCustomers(d.customers || d || []))
      .catch(() => {})
  }, [user?.currentShopId])

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (!search.trim()) {
      setHits([])
      return
    }
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/products?search=${encodeURIComponent(search)}&limit=15`)
        const data = await res.json()
        setHits(data.products || data || [])
      } catch {
        setHits([])
      }
    }, 250)
    return () => searchTimer.current && clearTimeout(searchTimer.current)
  }, [search])

  function addProduct(p: ProductHit) {
    setLines((prev) => {
      const existing = prev.find((l) => l.productId === p.id)
      if (existing) {
        return prev.map((l) => (l.productId === p.id ? { ...l, quantity: l.quantity + 1 } : l))
      }
      return [...prev, { productId: p.id, name: p.name, unit: p.unit, quantity: 1, unitPrice: Number(p.price) }]
    })
    setSearch('')
    setHits([])
  }

  function updateLine(productId: string, patch: Partial<Line>) {
    setLines((prev) => prev.map((l) => (l.productId === productId ? { ...l, ...patch } : l)))
  }
  function removeLine(productId: string) {
    setLines((prev) => prev.filter((l) => l.productId !== productId))
  }

  const subtotal = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0)
  const disc = Math.max(0, parseFloat(discount) || 0)
  const total = Math.max(0, subtotal - disc)

  async function save() {
    if (lines.length === 0 || saving) return
    setSaving(true)
    setError('')
    try {
      const payload = {
        customerId: customerId || null,
        customerName: customerName || null,
        items: lines.map((l) => ({
          productId: l.productId,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          lineTotal: Math.round(l.quantity * l.unitPrice * 100) / 100,
        })),
        subtotal: Math.round(subtotal * 100) / 100,
        discount: Math.round(disc * 100) / 100,
        total: Math.round(total * 100) / 100,
        validUntil: validUntil || null,
        note: note || null,
      }
      const res = await fetch('/api/quotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save quotation')
      router.push(`/store/quotations/${data.quotation.id}`)
    } catch (e: any) {
      setError(e.message || 'Failed to save')
      setSaving(false)
    }
  }

  if (!user?.currentShopId) {
    return <div className="p-6"><h1 className="text-2xl font-bold">New Quotation</h1><p className="text-gray-600">Please select a shop first</p></div>
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">New Quotation</h1>
        <Link href="/store/quotations" className="btn btn-outline h-9 px-4">Back</Link>
      </div>

      {error && <div className="mb-3 p-3 bg-red-100 text-red-700 rounded text-sm">{error}</div>}

      {/* Product search */}
      <div className="relative mb-4">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-gray-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products by name / SKU / barcode" className="h-10 flex-1" />
        </div>
        {hits.length > 0 && (
          <div className="absolute z-20 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-64 overflow-y-auto">
            {hits.map((p) => (
              <button key={p.id} type="button" onClick={() => addProduct(p)} className="w-full px-4 py-2 text-left hover:bg-gray-50 border-b last:border-b-0 flex justify-between">
                <span>{p.name} <span className="text-xs text-gray-400">{p.unit}</span></span>
                <span className="font-medium">{formatCurrency(Number(p.price))}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Lines */}
      <div className="border rounded-lg overflow-hidden mb-4">
        <table className="w-full text-sm">
          <thead className="bg-[hsl(var(--muted))]">
            <tr>
              <th className="text-left px-3 py-2">Item</th>
              <th className="text-right px-3 py-2 w-28">Qty</th>
              <th className="text-right px-3 py-2 w-32">Unit Price</th>
              <th className="text-right px-3 py-2 w-32">Line Total</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-500">Search and add products above.</td></tr>
            ) : (
              lines.map((l) => (
                <tr key={l.productId} className="border-t">
                  <td className="px-3 py-2">{l.name} <span className="text-xs text-gray-400">{l.unit}</span></td>
                  <td className="px-3 py-2 text-right">
                    <input type="number" min="0" step="0.001" value={l.quantity}
                      onChange={(e) => updateLine(l.productId, { quantity: Math.max(0, parseFloat(e.target.value) || 0) })}
                      className="input h-8 w-24 text-right" />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <input type="number" min="0" step="0.01" value={l.unitPrice}
                      onChange={(e) => updateLine(l.productId, { unitPrice: Math.max(0, parseFloat(e.target.value) || 0) })}
                      className="input h-8 w-28 text-right" />
                  </td>
                  <td className="px-3 py-2 text-right font-medium">{formatCurrency(l.quantity * l.unitPrice)}</td>
                  <td className="px-3 py-2 text-right">
                    <button type="button" onClick={() => removeLine(l.productId)} className="text-gray-400 hover:text-red-600" aria-label="Remove">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Customer (for udhaar conversion)</label>
            <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="input h-9 w-full">
              <option value="">None / walk-in</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}{c.phone ? ` (${c.phone})` : ''}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Or company name (free text)</label>
            <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="e.g. Mughal Builders" className="h-9" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Valid until</label>
            <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className="h-9" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Note</label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional (terms, delivery, etc.)" className="h-9" />
          </div>
        </div>

        <div className="rounded-lg border p-4 space-y-2 h-fit">
          <div className="flex justify-between text-sm"><span>Subtotal</span><span className="font-medium">{formatCurrency(subtotal)}</span></div>
          <div className="flex justify-between items-center text-sm">
            <span>Discount</span>
            <input type="number" min="0" step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0" className="input h-8 w-28 text-right" />
          </div>
          <div className="flex justify-between text-base font-bold border-t pt-2"><span>Total</span><span>{formatCurrency(total)}</span></div>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Link href="/store/quotations" className="btn btn-outline h-10 px-4">Cancel</Link>
        <Button onClick={save} disabled={lines.length === 0 || saving} className="h-10 px-6">
          {saving ? 'Saving...' : 'Save Quotation'}
        </Button>
      </div>
    </div>
  )
}
