'use client'

import { useState } from 'react'
import ReceiptModal from '@/components/receipt/ReceiptModal'

interface InvoiceSummary {
  id: string
  createdAt: string
  total: number
  invoiceNumber?: string | null
}

interface Props {
  invoices: InvoiceSummary[]
}

export default function CustomerInvoicesCard({ invoices }: Props) {
  const [receiptInvoice, setReceiptInvoice] = useState<any | null>(null)
  const [showReceipt, setShowReceipt] = useState(false)
  const [loadingId, setLoadingId] = useState<string | null>(null)

  async function handlePrintClick(id: string) {
    try {
      setLoadingId(id)
      const response = await fetch(`/api/sales/${id}`)
      if (!response.ok) {
        console.error('Failed to load invoice for printing')
        return
      }
      const data = await response.json()
      setReceiptInvoice(data.invoice)
      setShowReceipt(true)
    } catch (err) {
      console.error('Failed to load invoice for printing:', err)
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <>
      <div className="card">
        <div className="card-body">
          <h2 className="font-semibold mb-3">Recent Invoices</h2>
          {invoices.length === 0 ? (
            <div className="text-sm text-[hsl(var(--muted-foreground))]">No invoices yet.</div>
          ) : (
            <ul className="space-y-2 text-sm">
              {invoices.map((inv) => (
                <li key={inv.id} className="flex items-center justify-between gap-2">
                  <div className="flex flex-col">
                    <span>{new Date(inv.createdAt).toLocaleString()}</span>
                    {inv.invoiceNumber && (
                      <span className="text-xs text-[hsl(var(--muted-foreground))]">
                        #{inv.invoiceNumber}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{inv.total.toFixed(2)}</span>
                    <button
                      type="button"
                      onClick={() => handlePrintClick(inv.id)}
                      className="px-3 py-1 text-xs border rounded hover:bg-gray-50"
                      disabled={loadingId === inv.id}
                    >
                      {loadingId === inv.id ? 'Loading...' : 'View / Print'}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {showReceipt && receiptInvoice && (
        <ReceiptModal
          isOpen={showReceipt}
          onClose={() => {
            setShowReceipt(false)
            setReceiptInvoice(null)
          }}
          invoice={receiptInvoice}
        />
      )}
    </>
  )
}

