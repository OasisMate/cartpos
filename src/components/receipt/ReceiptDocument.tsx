import { formatNumber } from '@/lib/utils/money'

/**
 * The printed receipt body — the EXACT 80mm thermal layout.
 * Extracted verbatim from ReceiptModal so the on-paper print and the
 * customer-facing share page (/r/<token>) render the identical design.
 * DO NOT redesign this markup; it is hand-tuned for physical printing.
 */
export interface ReceiptDocumentInvoice {
  id: string
  number?: string
  createdAt: string
  shop?: {
    name: string
    city?: string | null
    phone?: string | null
    addressLine1?: string | null
    addressLine2?: string | null
    settings?: {
      logoUrl?: string | null
      receiptHeaderDisplay?: 'NAME_ONLY' | 'LOGO_ONLY' | 'BOTH'
      printerName?: string | null
    } | null
  } | null
  lines: Array<{
    id: string
    product: { name: string }
    quantity: string | number
    unitPrice: string | number
    lineTotal: string | number
  }>
  subtotal: string | number
  discount: string | number
  serviceCharge?: string | number
  deliveryCharge?: string | number
  total: string | number
  paymentStatus: 'PAID' | 'UDHAAR'
  paymentMethod?: 'CASH' | 'CARD' | 'OTHER' | null
  payments?: Array<{ amount: string | number }>
  customerName?: string | null
  customer?: { name?: string | null } | null
  /** Staff member who served the sale. Rendered as first name only on the receipt. */
  servedBy?: string | null
}

export default function ReceiptDocument({
  invoice,
  id,
}: {
  invoice: ReceiptDocumentInvoice
  id: string
}) {
  const dateStr = new Date(invoice.createdAt).toLocaleDateString('en-GB').replace(/\//g, '-')
  const timeStr = new Date(invoice.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
  const invoiceNumber = invoice.number || invoice.id.slice(0, 8)
  const subtotal = Number(invoice.subtotal)
  const discount = Number(invoice.discount)
  const total = Number(invoice.total)
  const serviceCharge = Number(invoice.serviceCharge ?? 0)
  const deliveryCharge = Number(invoice.deliveryCharge ?? 0)
  const paymentMethod = invoice.paymentStatus === 'PAID' ? (invoice.paymentMethod || 'CASH') : 'UDHAAR'
  const amountReceived = invoice.payments && invoice.payments.length > 0 ? Number(invoice.payments[0].amount) : undefined
  const change = amountReceived ? amountReceived - total : undefined
  // Card fee is implicit in the total (total = subtotal - discount + service + delivery + fee). Derive it for display.
  const cardFee = paymentMethod === 'CARD' ? Math.max(0, total - (subtotal - discount) - serviceCharge - deliveryCharge) : 0
  // Udhaar bills: show how much was paid and what's still owed on this bill.
  const paidTotal = (invoice.payments || []).reduce((s, p) => s + Number(p.amount), 0)
  const balanceDue = Math.max(0, total - paidTotal)

  // Receipt header display settings
  const receiptHeaderDisplay = invoice.shop?.settings?.receiptHeaderDisplay || 'NAME_ONLY'
  const logoUrl = invoice.shop?.settings?.logoUrl
  const showName = receiptHeaderDisplay === 'NAME_ONLY' || receiptHeaderDisplay === 'BOTH'
  const showLogo = receiptHeaderDisplay === 'LOGO_ONLY' || receiptHeaderDisplay === 'BOTH'
  const customerName = invoice.customerName || invoice.customer?.name || null
  // First name only on the printed/customer-facing receipt.
  const servedBy = invoice.servedBy ? invoice.servedBy.trim().split(/\s+/)[0] : null

  return (
    <div id={id} className="bg-white text-gray-900 mx-auto" style={{ maxWidth: '80mm', paddingTop: 0, marginTop: 0 }}>
      {/* Store Header */}
      <div className="text-center mb-3" style={{ fontFamily: 'Arial, sans-serif', marginTop: 0, paddingTop: 0, marginBottom: '3mm' }}>
        {/* Logo */}
        {showLogo && logoUrl && (
          <div className="mb-2" style={{ textAlign: 'center' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoUrl}
              alt={invoice.shop?.name || 'Store logo'}
              className="mx-auto object-contain"
              style={{
                maxWidth: '200px',
                maxHeight: '80px',
                objectFit: 'contain',
                display: 'block',
                marginLeft: 'auto',
                marginRight: 'auto'
              }}
            />
          </div>
        )}
        {/* Store Name */}
        {showName && (
          <div className="text-2xl font-bold text-gray-900 mb-1" style={{ fontSize: '18pt', fontWeight: 'bold' }}>
            {invoice.shop?.name || 'Shop'}
          </div>
        )}
        {/* Full Address */}
        <div className="text-sm text-gray-900" style={{ fontSize: '9pt', lineHeight: '1.3' }}>
          {invoice.shop?.addressLine1 && <div>{invoice.shop.addressLine1}</div>}
          {invoice.shop?.addressLine2 && <div>{invoice.shop.addressLine2}</div>}
          {invoice.shop?.city && <div>{invoice.shop.city}</div>}
        </div>
        {invoice.shop?.phone && (
          <div className="text-sm text-gray-900 mt-1" style={{ fontSize: '9pt' }}>{invoice.shop.phone}</div>
        )}
      </div>

      {/* Sale Invoice Label */}
      <div className="text-center" style={{ paddingTop: '0.5mm', paddingBottom: '0.5mm', marginTop: '0.5mm', marginBottom: '0.5mm' }}>
        <div className="text-base font-semibold underline" style={{ fontSize: '11pt', fontWeight: '600', textDecoration: 'underline' }}>Sale Invoice</div>
      </div>

      {/* Invoice Info - Two columns layout */}
      <div className="mb-3 text-sm" style={{ fontSize: '9pt' }}>
        <div className="flex justify-between mb-1">
          <span className="font-semibold">Inv #: <span className="font-normal">{invoiceNumber}</span></span>
          <span className="font-semibold">Date: <span className="font-normal">{dateStr}</span></span>
        </div>
        <div className="flex justify-between">
          <span className="font-semibold">M.O.P: <span className="font-normal">{paymentMethod}</span></span>
          <span className="font-semibold">Time: <span className="font-normal">{timeStr}</span></span>
        </div>
        {invoice.paymentStatus === 'UDHAAR' && customerName && (
          <div className="mt-1">
            <span className="font-semibold">Customer: </span>
            <span className="font-normal">{customerName}</span>
          </div>
        )}
        {servedBy && (
          <div className="mt-1">
            <span className="font-semibold">Served by: </span>
            <span className="font-normal">{servedBy}</span>
          </div>
        )}
      </div>

      {/* Simple Dotted Divider */}
      <div className="border-t border-dotted border-gray-600 my-2" style={{ borderTop: '1px dotted #000' }}></div>

      {/* Items Table */}
      <div className="mb-3">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-gray-900">
              <th className="text-left py-1.5 font-bold" style={{ fontSize: '9pt', fontWeight: 'bold' }}>Sr#</th>
              <th className="text-left py-1.5 font-bold" style={{ fontSize: '9pt', fontWeight: 'bold' }}>Description</th>
              <th className="text-right py-1.5 font-bold" style={{ fontSize: '9pt', fontWeight: 'bold' }}>Price</th>
              <th className="text-right py-1.5 font-bold" style={{ fontSize: '9pt', fontWeight: 'bold' }}>Qty</th>
              <th className="text-right py-1.5 font-bold" style={{ fontSize: '9pt', fontWeight: 'bold' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((line, idx) => (
              <tr key={line.id || idx} className="border-b border-gray-200">
                <td className="py-1.5 text-gray-900" style={{ fontSize: '9pt' }}>{idx + 1}</td>
                <td className="py-1.5 text-gray-900 font-medium" style={{ fontSize: '9pt', fontWeight: '500' }}>{line.product.name}</td>
                <td className="py-1.5 text-right text-gray-900" style={{ fontSize: '9pt' }}>{formatNumber(Number(line.unitPrice))}</td>
                <td className="py-1.5 text-right text-gray-900" style={{ fontSize: '9pt' }}>{formatNumber(Number(line.quantity))}</td>
                <td className="py-1.5 text-right text-gray-900 font-semibold" style={{ fontSize: '9pt', fontWeight: '600' }}>{formatNumber(Number(line.lineTotal))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Simple Dotted Divider */}
      <div className="border-t border-dotted border-gray-600 my-2" style={{ borderTop: '1px dotted #000' }}></div>

      {/* Summary */}
      <div className="space-y-1.5 mb-3" style={{ fontSize: '9pt' }}>
        {/* Always show subtotal if there's a discount, or if subtotal differs from total */}
        {(discount > 0 || Math.abs(subtotal - total) > 0.01) && (
          <div className="flex justify-between">
            <span style={{ fontWeight: '500' }}>Subtotal:</span>
            <span style={{ fontWeight: '500' }}>{formatNumber(subtotal)}</span>
          </div>
        )}
        {/* Show discount only if it's greater than 0 */}
        {discount > 0 && (
          <div className="flex justify-between">
            <span className="font-medium">Discount:</span>
            <span className="font-medium">-{formatNumber(discount)}</span>
          </div>
        )}
        {/* Service charge (dine-in) */}
        {serviceCharge > 0.01 && (
          <div className="flex justify-between">
            <span className="font-medium">Service Charge:</span>
            <span className="font-medium">+{formatNumber(serviceCharge)}</span>
          </div>
        )}
        {/* Delivery charge */}
        {deliveryCharge > 0.01 && (
          <div className="flex justify-between">
            <span className="font-medium">Delivery:</span>
            <span className="font-medium">+{formatNumber(deliveryCharge)}</span>
          </div>
        )}
        {/* Show card fee if applied (kept transparent for the customer) */}
        {cardFee > 0.01 && (
          <div className="flex justify-between">
            <span className="font-medium">Card Fee:</span>
            <span className="font-medium">+{formatNumber(cardFee)}</span>
          </div>
        )}
        <div className="flex justify-between font-bold pt-1 border-t border-gray-400" style={{ fontSize: '10pt', fontWeight: 'bold', paddingTop: '2mm' }}>
          <span>Grand Total:</span>
          <span>{formatNumber(total)}</span>
        </div>
        {invoice.paymentStatus === 'UDHAAR' && (
          <>
            <div className="flex justify-between pt-1" style={{ fontSize: '9pt', paddingTop: '1mm' }}>
              <span className="font-medium">Paid:</span>
              <span className="font-medium">{formatNumber(paidTotal)}</span>
            </div>
            <div className="flex justify-between font-bold" style={{ fontSize: '10pt', fontWeight: 'bold' }}>
              <span>Balance Due (Udhaar):</span>
              <span>{formatNumber(balanceDue)}</span>
            </div>
          </>
        )}
        {invoice.paymentStatus === 'PAID' && invoice.paymentMethod === 'CASH' && amountReceived !== undefined && (
          <>
            <div className="flex justify-between pt-1" style={{ fontSize: '9pt', paddingTop: '1mm' }}>
              <span className="font-medium">Cash Paid:</span>
              <span className="font-medium">{formatNumber(amountReceived)}</span>
            </div>
            {change !== undefined && change > 0 && (
              <div className="flex justify-between" style={{ fontSize: '9pt' }}>
                <span className="font-medium">Change:</span>
                <span className="font-medium">{formatNumber(change)}</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="text-center pt-2 border-t border-dotted border-gray-600" style={{ fontSize: '9pt', paddingTop: '2mm', borderTop: '1px dotted #000' }}>
        <div className="mt-2" style={{ marginTop: '2mm' }}>Shukriya! Visit again.</div>
      </div>
    </div>
  )
}
