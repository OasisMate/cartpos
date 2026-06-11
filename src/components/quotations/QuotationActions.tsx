'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { Printer, MessageCircle } from 'lucide-react'
import { formatNumber } from '@/lib/utils/money'
import { waUrl } from '@/lib/utils/whatsapp'

interface QuotationLite {
  id: string
  number: string | null
  status: 'OPEN' | 'CONVERTED' | 'CANCELLED'
  hasCustomer: boolean
  customerName: string | null
  customerPhone: string | null
  total: number
  shopName: string | null
  convertedInvoiceId: string | null
}

type Settle = 'CASH' | 'CARD' | 'UDHAAR'

export default function QuotationActions({ quotation: q }: { quotation: QuotationLite }) {
  const router = useRouter()
  const [showConvert, setShowConvert] = useState(false)
  const [settle, setSettle] = useState<Settle>('CASH')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function share() {
    const lines = [
      `${q.shopName || 'Shop'} — Quotation ${q.number || ''}`.trim(),
      q.customerName ? `For: ${q.customerName}` : '',
      `Total: Rs.${formatNumber(q.total)}`,
      'This is a price estimate. Shukriya!',
    ].filter(Boolean)
    window.open(waUrl(q.customerPhone, lines.join('\n')), '_blank', 'noopener,noreferrer')
  }

  async function convert() {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const body =
        settle === 'UDHAAR'
          ? { paymentStatus: 'UDHAAR' }
          : { paymentStatus: 'PAID', paymentMethod: settle }
      const res = await fetch(`/api/quotations/${q.id}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to convert')
      router.push('/store/sales')
      router.refresh()
    } catch (e: any) {
      setError(e.message || 'Failed to convert')
      setBusy(false)
    }
  }

  async function cancel() {
    if (busy) return
    if (!confirm('Cancel this quotation?')) return
    setBusy(true)
    try {
      const res = await fetch(`/api/quotations/${q.id}/cancel`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to cancel')
      router.refresh()
    } catch (e: any) {
      setError(e.message || 'Failed to cancel')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {error && <span className="text-sm text-red-600">{error}</span>}

      <button type="button" onClick={share} className="btn h-9 px-4 inline-flex items-center gap-2 bg-green-600 text-white hover:bg-green-700">
        <MessageCircle className="h-4 w-4" /> <span>Share</span>
      </button>
      <button type="button" onClick={() => window.print()} className="btn btn-primary h-9 px-4 inline-flex items-center gap-2">
        <Printer className="h-4 w-4" /> <span>Print</span>
      </button>

      {q.status === 'OPEN' && (
        <>
          <Button variant="outline" className="h-9 px-4" onClick={cancel} disabled={busy}>Cancel quote</Button>
          <Button className="h-9 px-4" onClick={() => setShowConvert(true)} disabled={busy}>Convert to Sale</Button>
        </>
      )}

      <Modal open={showConvert} onClose={() => setShowConvert(false)} title="Convert to Sale" size="sm">
        <div className="space-y-3">
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            How is this {q.number ? `(${q.number}) ` : ''}being paid? This creates the sale and deducts stock.
          </p>
          {error && <div className="p-2 bg-red-100 text-red-700 rounded text-sm">{error}</div>}
          <div className="space-y-2">
            {([
              ['CASH', 'Cash (paid now)'],
              ['CARD', 'Card (paid now)'],
              ['UDHAAR', 'Udhaar (credit)'],
            ] as const).map(([val, label]) => {
              const disabled = val === 'UDHAAR' && !q.hasCustomer
              return (
                <label key={val} className={`flex items-center gap-2 rounded-md border p-2 ${disabled ? 'opacity-50' : 'cursor-pointer hover:bg-gray-50'}`}>
                  <input type="radio" name="settle" checked={settle === val} disabled={disabled} onChange={() => setSettle(val)} />
                  <span className="text-sm">{label}</span>
                  {disabled && <span className="text-xs text-gray-400">(needs a registered customer)</span>}
                </label>
              )
            })}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowConvert(false)} disabled={busy}>Cancel</Button>
            <Button onClick={convert} disabled={busy}>{busy ? 'Converting...' : 'Confirm & create sale'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
