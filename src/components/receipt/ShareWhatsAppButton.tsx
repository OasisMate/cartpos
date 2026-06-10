'use client'

import { useState } from 'react'
import { MessageCircle } from 'lucide-react'
import { formatNumber } from '@/lib/utils/money'

interface ShareInvoice {
  id: string
  number?: string
  createdAt: string
  total: string | number
  paymentStatus: 'PAID' | 'UDHAAR'
  payments?: Array<{ amount: string | number }>
  shop?: { name?: string | null } | null
}

/** PK numbers stored as 03xxxxxxxxx → wa.me wants international 92xxxxxxxxx. */
function toWaNumber(phone: string | null): string {
  if (!phone) return ''
  const digits = phone.replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('0')) return '92' + digits.slice(1)
  if (digits.startsWith('92')) return digits
  if (digits.length === 10) return '92' + digits // bare 3xxxxxxxxx
  return digits
}

export default function ShareWhatsAppButton({ invoice }: { invoice: ShareInvoice }) {
  const [loading, setLoading] = useState(false)

  async function handleShare() {
    if (loading) return
    setLoading(true)
    try {
      const resp = await fetch(`/api/sales/${invoice.id}/share`)
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.error || 'Failed to create share link')

      const link = `${window.location.origin}/r/${data.token}`
      const total = Number(invoice.total)
      const paid = (invoice.payments || []).reduce((s, p) => s + Number(p.amount), 0)
      const unpaid = Math.max(0, total - paid)
      const invNo = invoice.number || invoice.id.slice(0, 8)
      const dateStr = new Date(invoice.createdAt).toLocaleDateString('en-GB').replace(/\//g, '-')

      const lines = [
        invoice.shop?.name || 'Sale receipt',
        `Inv #${invNo} • ${dateStr}`,
        `Total: Rs.${formatNumber(total)}`,
      ]
      if (unpaid > 0.01) lines.push(`Unpaid (this bill): Rs.${formatNumber(unpaid)}`)
      lines.push(`Receipt: ${link}`, 'Shukriya!')

      const text = encodeURIComponent(lines.join('\n'))
      const wa = toWaNumber(data.customerPhone)
      const url = wa ? `https://wa.me/${wa}?text=${text}` : `https://wa.me/?text=${text}`
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (err) {
      console.error('WhatsApp share failed:', err)
      alert('Could not create the share link. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      disabled={loading}
      className="flex-1 inline-flex items-center justify-center gap-2 rounded-md bg-green-600 px-4 py-2 font-medium text-white hover:bg-green-700 disabled:opacity-60"
    >
      <MessageCircle className="h-4 w-4" />
      {loading ? 'Preparing…' : 'WhatsApp'}
    </button>
  )
}
