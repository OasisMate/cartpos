'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

export default function ReceiptPage() {
  const params = useParams<{ id: string }>()
  const [invoice, setInvoice] = useState<any>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const resp = await fetch(`/api/sales/${params.id}`)
        const data = await resp.json()
        if (!resp.ok) throw new Error(data.error || 'Failed to load invoice')
        setInvoice(data.invoice)
      } catch (err: any) {
        setError(err.message || 'Failed to load invoice')
      }
    }
    load()
  }, [params.id])

  useEffect(() => {
    if (invoice) {
      // Slight delay to allow layout
      setTimeout(() => window.print(), 300)
    }
  }, [invoice])

  if (error) {
    return <div className="p-4 text-red-600">{error}</div>
  }
  if (!invoice) {
    return <div className="p-4">Loading...</div>
  }

  return (
    <div className="p-4 print:p-0">
      <div className="mx-auto w-[80mm] print:w-[80mm] border p-3 print:border-0">
        <div className="text-center mb-2">
          <div className="font-bold">{invoice.shop?.name || 'CartPOS Shop'}</div>
          <div className="text-xs text-gray-600">{invoice.shop?.city || ''}</div>
        </div>
        <div className="text-xs mb-2">
          <div>Invoice: {invoice.id.slice(0, 8)}</div>
          <div>Date: {new Date(invoice.createdAt).toLocaleString()}</div>
          {invoice.customer && <div>Customer: {invoice.customer.name}</div>}
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-t border-b">
              <th className="text-left py-1">Item</th>
              <th className="text-right py-1">Qty</th>
              <th className="text-right py-1">Rate</th>
              <th className="text-right py-1">Amt</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((l: any) => (
              <tr key={l.id}>
                <td className="pr-1">{l.product.name}</td>
                <td className="text-right">{Number(l.quantity).toFixed(0)}</td>
                <td className="text-right">{Number(l.unitPrice).toFixed(2)}</td>
                <td className="text-right">{Number(l.lineTotal).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="border-t mt-2 pt-2 text-xs">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>Rs {Number(invoice.subtotal).toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>Discount</span>
            <span>Rs {Number(invoice.discount).toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-semibold">
            <span>Total</span>
            <span>Rs {Number(invoice.total).toFixed(2)}</span>
          </div>
          {invoice.paymentStatus === 'PAID' && (
            <div className="mt-1 text-right">
              <span className="text-green-700">PAID</span>
            </div>
          )}
          {invoice.paymentStatus === 'UDHAAR' && (
            <div className="mt-1 text-right">
              <span className="text-yellow-700">UDHAAR</span>
            </div>
          )}
        </div>
        <div className="mt-2 text-center text-xs">
          <div>Shukriya! Visit again.</div>
        </div>
      </div>
      <style jsx global>{`
        @media print {
          @page {
            size: 80mm auto;
            margin: 0;
          }
          body {
            background: white !important;
          }
        }
      `}</style>
    </div>
  )
}


