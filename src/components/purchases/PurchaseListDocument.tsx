import { formatNumber } from '@/lib/utils/money'
import { format } from 'date-fns'

/**
 * The printed purchase list. Mirrors ReceiptDocument's 80mm shell so it comes
 * off the same thermal printer looking like the shop's other paperwork, with
 * one deliberate difference: there is no money on it anywhere. It is an order
 * chit, not a bill. ReceiptDocument itself is hand-tuned and must not be edited.
 */

export interface PurchaseListDocumentLine {
  name: string
  quantity: number
  unit?: string | null
}

export interface PurchaseListDocumentProps {
  id: string
  paper: '80mm' | 'a4'
  shop: {
    name?: string | null
    addressLine1?: string | null
    addressLine2?: string | null
    city?: string | null
    phone?: string | null
    logoUrl?: string | null
  }
  list: {
    name?: string | null
    supplierName?: string | null
    createdAt: Date
    notes?: string | null
    lines: PurchaseListDocumentLine[]
  }
}

export default function PurchaseListDocument({ id, paper, shop, list }: PurchaseListDocumentProps) {
  const thermal = paper === '80mm'
  const bodySize = thermal ? '9pt' : '11pt'
  const nameSize = thermal ? '18pt' : '20pt'

  return (
    <div
      id={id}
      className="bg-white text-gray-900 mx-auto"
      style={{ maxWidth: thermal ? '80mm' : '190mm', paddingTop: 0, marginTop: 0 }}
    >
      {/* Store header - same shape as the sale receipt */}
      <div
        className="text-center"
        style={{ fontFamily: 'Arial, sans-serif', marginTop: 0, paddingTop: 0, marginBottom: '3mm' }}
      >
        {shop.logoUrl && (
          <div style={{ textAlign: 'center', marginBottom: '2mm' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={shop.logoUrl}
              alt={shop.name || 'Store logo'}
              style={{ maxWidth: '200px', maxHeight: '80px', objectFit: 'contain', display: 'block', marginLeft: 'auto', marginRight: 'auto' }}
            />
          </div>
        )}
        <div style={{ fontSize: nameSize, fontWeight: 'bold' }}>{shop.name || 'Shop'}</div>
        <div style={{ fontSize: '9pt', lineHeight: '1.3' }}>
          {shop.addressLine1 && <div>{shop.addressLine1}</div>}
          {shop.addressLine2 && <div>{shop.addressLine2}</div>}
          {shop.city && <div>{shop.city}</div>}
        </div>
        {shop.phone && <div style={{ fontSize: '9pt', marginTop: '1mm' }}>{shop.phone}</div>}
      </div>

      <div className="text-center" style={{ paddingTop: '0.5mm', paddingBottom: '0.5mm', marginBottom: '1mm' }}>
        <div style={{ fontSize: thermal ? '11pt' : '13pt', fontWeight: 600, textDecoration: 'underline' }}>
          Purchase List
        </div>
      </div>

      <div style={{ fontSize: bodySize, marginBottom: '2mm' }}>
        {list.name && <div>{list.name}</div>}
        {list.supplierName && <div>Supplier: {list.supplierName}</div>}
        <div>Date: {format(list.createdAt, 'dd/MM/yyyy')}</div>
      </div>

      <div style={{ borderTop: '1px dotted #000', paddingTop: '1.5mm' }}>
        <div style={{ display: 'flex', fontSize: bodySize, fontWeight: 'bold', paddingBottom: '1mm' }}>
          <div style={{ width: '8mm' }}>#</div>
          <div style={{ flex: 1 }}>Item</div>
          <div style={{ width: thermal ? '18mm' : '30mm', textAlign: 'right' }}>Qty</div>
        </div>
        {list.lines.map((line, i) => (
          <div
            key={`${line.name}-${i}`}
            style={{
              display: 'flex',
              fontSize: bodySize,
              paddingTop: '0.8mm',
              paddingBottom: '0.8mm',
              borderBottom: thermal ? 'none' : '1px solid #ddd',
            }}
          >
            <div style={{ width: '8mm' }}>{i + 1}</div>
            <div style={{ flex: 1, paddingRight: '2mm' }}>{line.name}</div>
            <div style={{ width: thermal ? '18mm' : '30mm', textAlign: 'right' }}>
              {formatNumber(line.quantity)}
              {line.unit ? ` ${line.unit}` : ''}
            </div>
          </div>
        ))}
      </div>

      <div style={{ borderTop: '1px dotted #000', marginTop: '2mm', paddingTop: '1.5mm', fontSize: bodySize }}>
        <div style={{ fontWeight: 'bold' }}>Total items: {list.lines.length}</div>
        {list.notes && <div style={{ marginTop: '1.5mm' }}>Note: {list.notes}</div>}
        <div style={{ marginTop: thermal ? '6mm' : '12mm' }}>Received by: ________________</div>
      </div>
    </div>
  )
}
