import { formatNumber } from '@/lib/utils/money'

/**
 * The printed purchase list.
 *
 * This is ReceiptDocument's layout, reused rather than reinvented: same header
 * block, same underlined title, same two-column info rows, same bordered items
 * table, same dotted dividers, same footer rule. A shopkeeper should recognise
 * it as the shop's own paperwork the moment it comes off the printer.
 *
 * Only two things differ, both deliberate:
 *   - no money anywhere (it is an order chit, not a bill), so the Price and
 *     Total columns are gone and the summary counts items instead;
 *   - an optional A4 size, which widens the sheet and scales the type while
 *     keeping every border and class identical.
 *
 * ReceiptDocument itself is hand-tuned for physical printing and must not be
 * edited. When it changes, mirror the change here rather than diverging.
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
  // The 80mm column is ReceiptDocument's exact type scale. A4 steps each size
  // up together so the proportions of the printed sheet stay the same.
  const nameSize = thermal ? '18pt' : '22pt'
  const titleSize = thermal ? '11pt' : '13pt'
  const bodySize = thermal ? '9pt' : '11pt'
  const totalSize = thermal ? '10pt' : '12pt'

  const dateStr = new Date(list.createdAt).toLocaleDateString('en-GB').replace(/\//g, '-')

  return (
    <div
      id={id}
      className="bg-white text-gray-900 mx-auto"
      style={{ maxWidth: thermal ? '80mm' : '190mm', paddingTop: 0, marginTop: 0 }}
    >
      {/* Store Header */}
      <div
        className="text-center mb-3"
        style={{ fontFamily: 'Arial, sans-serif', marginTop: 0, paddingTop: 0, marginBottom: '3mm' }}
      >
        {shop.logoUrl && (
          <div className="mb-2" style={{ textAlign: 'center' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={shop.logoUrl}
              alt={shop.name || 'Store logo'}
              className="mx-auto object-contain"
              style={{
                maxWidth: '200px',
                maxHeight: '80px',
                objectFit: 'contain',
                display: 'block',
                marginLeft: 'auto',
                marginRight: 'auto',
              }}
            />
          </div>
        )}
        {/* Omitted entirely when the shop prints logo-only, as on the receipt. */}
        {shop.name && (
          <div
            className="text-2xl font-bold text-gray-900 mb-1"
            style={{ fontSize: nameSize, fontWeight: 'bold' }}
          >
            {shop.name}
          </div>
        )}
        <div className="text-sm text-gray-900" style={{ fontSize: bodySize, lineHeight: '1.3' }}>
          {shop.addressLine1 && <div>{shop.addressLine1}</div>}
          {shop.addressLine2 && <div>{shop.addressLine2}</div>}
          {shop.city && <div>{shop.city}</div>}
        </div>
        {shop.phone && (
          <div className="text-sm text-gray-900 mt-1" style={{ fontSize: bodySize }}>
            {shop.phone}
          </div>
        )}
      </div>

      {/* Purchase List Label */}
      <div
        className="text-center"
        style={{
          paddingTop: '0.5mm',
          paddingBottom: '0.5mm',
          marginTop: '0.5mm',
          marginBottom: '0.5mm',
        }}
      >
        <div
          className="text-base font-semibold underline"
          style={{ fontSize: titleSize, fontWeight: '600', textDecoration: 'underline' }}
        >
          Purchase List
        </div>
      </div>

      {/* List Info - two columns, as on the invoice */}
      <div className="mb-3 text-sm" style={{ fontSize: bodySize }}>
        <div className="flex justify-between mb-1">
          <span className="font-semibold">
            List: <span className="font-normal">{list.name || '-'}</span>
          </span>
          <span className="font-semibold">
            Date: <span className="font-normal">{dateStr}</span>
          </span>
        </div>
        {list.supplierName && (
          <div className="mt-1">
            <span className="font-semibold">Supplier: </span>
            <span className="font-normal">{list.supplierName}</span>
          </div>
        )}
      </div>

      {/* Simple Dotted Divider */}
      <div
        className="border-t border-dotted border-gray-600 my-2"
        style={{ borderTop: '1px dotted #000' }}
      ></div>

      {/* Items Table - the invoice table minus Price and Total */}
      <div className="mb-3">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-gray-900">
              <th
                className="text-left py-1.5 font-bold"
                style={{ fontSize: bodySize, fontWeight: 'bold' }}
              >
                Sr#
              </th>
              <th
                className="text-left py-1.5 font-bold"
                style={{ fontSize: bodySize, fontWeight: 'bold' }}
              >
                Description
              </th>
              <th
                className="text-right py-1.5 font-bold"
                style={{ fontSize: bodySize, fontWeight: 'bold' }}
              >
                Qty
              </th>
            </tr>
          </thead>
          <tbody>
            {list.lines.map((line, idx) => (
              <tr key={`${line.name}-${idx}`} className="border-b border-gray-200">
                <td className="py-1.5 text-gray-900" style={{ fontSize: bodySize }}>
                  {idx + 1}
                </td>
                <td
                  className="py-1.5 text-gray-900 font-medium"
                  style={{ fontSize: bodySize, fontWeight: '500' }}
                >
                  {line.name}
                </td>
                <td
                  className="py-1.5 text-right text-gray-900 font-semibold"
                  style={{ fontSize: bodySize, fontWeight: '600' }}
                >
                  {formatNumber(line.quantity)}
                  {line.unit ? ` ${line.unit}` : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Simple Dotted Divider */}
      <div
        className="border-t border-dotted border-gray-600 my-2"
        style={{ borderTop: '1px dotted #000' }}
      ></div>

      {/* Summary - a count where the invoice totals money */}
      <div className="space-y-1.5 mb-3" style={{ fontSize: bodySize }}>
        <div
          className="flex justify-between font-bold pt-1 border-t border-gray-400"
          style={{ fontSize: totalSize, fontWeight: 'bold', paddingTop: '2mm' }}
        >
          <span>Total Items:</span>
          <span>{list.lines.length}</span>
        </div>
        {list.notes && (
          <div className="pt-1" style={{ paddingTop: '1mm' }}>
            <span className="font-semibold">Note: </span>
            <span className="font-normal">{list.notes}</span>
          </div>
        )}
      </div>

      {/* Footer - the signature line the supplier hands back */}
      <div
        className="text-center pt-2 border-t border-dotted border-gray-600"
        style={{ fontSize: bodySize, paddingTop: '2mm', borderTop: '1px dotted #000' }}
      >
        <div className="mt-2" style={{ marginTop: thermal ? '6mm' : '12mm' }}>
          Received by: ________________
        </div>
      </div>
    </div>
  )
}
