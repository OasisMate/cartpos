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
      const { printReceipt } = require('@/lib/utils/print')
      setTimeout(() => printReceipt('receipt-print-content', { silent: true }), 100)
    }
  }, [invoice])

  if (error) return <div className="p-4 text-red-600">{error}</div>
  if (!invoice) return <div className="p-4">Loading...</div>

  const dateStr = new Date(invoice.createdAt).toLocaleDateString('en-GB').replace(/\//g, '-')
  const timeStr = new Date(invoice.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })

  return (
    <div className="p-4 print:p-0">
      <div id="receipt-print-content" className="mx-auto bg-white p-2" style={{ maxWidth: '300px', fontFamily: 'Arial, sans-serif', fontSize: '10pt', lineHeight: '1.2' }}>
        {/* Header */}
        <div className="shop-name">{invoice.shop?.name || 'Shop'}</div>
        {invoice.shop?.city && <div className="shop-address">{invoice.shop.city}</div>}
        {invoice.shop?.phone && <div className="shop-phone">{invoice.shop.phone}</div>}
        <div className="sale-invoice">Sale Invoice</div>
        
        {/* Invoice Info */}
        <div className="info-grid">
          <div className="info-row">
            <div className="info-col"><span className="label">Inv #:</span><span>{invoice.number || invoice.id.slice(0, 8)}</span></div>
            <div className="info-col"><span className="label">Date:</span><span>{dateStr}</span></div>
          </div>
          <div className="info-row">
            <div className="info-col"><span className="label">M.O.P:</span><span>{invoice.paymentStatus === 'PAID' ? (invoice.paymentMethod || 'Cash') : 'UDHAAR'}</span></div>
            <div className="info-col"><span className="label">Time:</span><span>{timeStr}</span></div>
          </div>
        </div>
        
        <div className="divider"></div>
        
        {/* Items Table */}
        <table>
          <thead>
            <tr>
              <th>Sr#</th>
              <th>Item Details</th>
              <th className="price">Price</th>
              <th className="qty">Qty</th>
              <th className="total">Total</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((l: any, idx: number) => (
              <tr key={l.id}>
                <td className="sn">{idx + 1}</td>
                <td className="item-name">{l.product.name}</td>
                <td className="price">{Number(l.unitPrice).toFixed(0)}</td>
                <td className="qty">{Number(l.quantity).toFixed(0)}</td>
                <td className="total">{Number(l.lineTotal).toFixed(0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        
        <div className="divider"></div>
        
        {/* Summary */}
        <div className="summary">
          {Number(invoice.discount) > 0 && (
            <>
              <div className="summary-row"><span>Subtotal:</span><span>{Number(invoice.subtotal).toFixed(0)}</span></div>
              <div className="summary-row"><span>Discount:</span><span>-{Number(invoice.discount).toFixed(0)}</span></div>
            </>
          )}
          <div className="summary-row total"><span>Grand Total:</span><span>{Number(invoice.total).toFixed(0)}</span></div>
        </div>
        
        {/* Footer */}
        <div className="footer">
          <div className="footer-row"><span>Total Items:</span><span>{invoice.lines.length}</span></div>
          <div style={{ textAlign: 'center', marginTop: '1mm' }}>Shukriya! Visit again.</div>
        </div>
      </div>
    </div>
  )
}
