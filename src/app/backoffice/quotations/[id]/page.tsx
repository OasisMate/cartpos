import { getCurrentUser } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getQuotation } from '@/lib/domain/quotations'
import { formatCurrency } from '@/lib/utils/money'
import QuotationActions from '@/components/quotations/QuotationActions'

export default async function QuotationDetailPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (!user.currentShopId) redirect('/select-shop')

  let q
  try {
    q = await getQuotation(user.currentShopId, params.id)
  } catch {
    return notFound()
  }

  const customerName = q.customer?.name || q.customerName || null
  const generatedAt = new Date()

  return (
    <div className="p-6">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #quote, #quote * { visibility: visible; }
          #quote { position: absolute; left: 0; top: 0; width: 100%; padding: 0; }
          .no-print { display: none !important; }
          @page { size: A4; margin: 14mm; }
        }
      `}</style>

      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link href="/store/quotations" className="btn btn-outline h-9 px-4">Back</Link>
        <QuotationActions
          quotation={{
            id: q.id,
            number: q.number,
            status: q.status,
            hasCustomer: !!q.customerId,
            customerName,
            customerPhone: q.customer?.phone ?? null,
            total: Number(q.total),
            shopName: q.shop?.name ?? null,
            convertedInvoiceId: q.convertedInvoiceId,
          }}
        />
      </div>

      {q.status === 'CONVERTED' && (
        <div className="no-print mb-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          Converted to a sale.{' '}
          {q.convertedInvoiceId && <Link href={`/store/sales`} className="font-medium underline">View in Sales</Link>}
        </div>
      )}
      {q.status === 'CANCELLED' && (
        <div className="no-print mb-4 rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">This quotation was cancelled.</div>
      )}

      <div id="quote" className="mx-auto max-w-2xl bg-white text-black">
        <div className="flex items-start justify-between border-b-2 border-black pb-3 mb-4">
          <div>
            <div className="text-xl font-bold">{q.shop?.name || 'Quotation'}</div>
            <div className="text-sm">QUOTATION / ESTIMATE</div>
          </div>
          <div className="text-right text-sm">
            <div className="font-bold">{q.number || q.id.slice(0, 8)}</div>
            <div>{new Date(q.createdAt).toLocaleDateString()}</div>
            {q.validUntil && <div>Valid until: {new Date(q.validUntil).toLocaleDateString()}</div>}
          </div>
        </div>

        {customerName && (
          <div className="mb-3 text-sm">
            <span className="text-gray-600">For: </span>
            <span className="font-medium">{customerName}</span>
            {q.customer?.phone ? ` (${q.customer.phone})` : ''}
          </div>
        )}

        <table className="w-full text-sm border-collapse mb-4">
          <thead>
            <tr className="border-b-2 border-black">
              <th className="text-left py-1.5">Item</th>
              <th className="text-right py-1.5">Qty</th>
              <th className="text-right py-1.5">Unit Price</th>
              <th className="text-right py-1.5">Amount</th>
            </tr>
          </thead>
          <tbody>
            {q.lines.map((l) => (
              <tr key={l.id} className="border-b border-gray-200">
                <td className="py-1.5">{l.product.name}</td>
                <td className="py-1.5 text-right">{Number(l.quantity)} {l.product.unit}</td>
                <td className="py-1.5 text-right">{formatCurrency(Number(l.unitPrice))}</td>
                <td className="py-1.5 text-right font-medium">{formatCurrency(Number(l.lineTotal))}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr><td colSpan={3} className="py-1.5 text-right">Subtotal</td><td className="py-1.5 text-right">{formatCurrency(Number(q.subtotal))}</td></tr>
            {Number(q.discount) > 0 && (
              <tr><td colSpan={3} className="py-1.5 text-right">Discount</td><td className="py-1.5 text-right">-{formatCurrency(Number(q.discount))}</td></tr>
            )}
            <tr className="border-t-2 border-black"><td colSpan={3} className="py-2 text-right font-bold">Total</td><td className="py-2 text-right font-bold">{formatCurrency(Number(q.total))}</td></tr>
          </tfoot>
        </table>

        {q.note && <div className="text-sm mb-3"><span className="text-gray-600">Note: </span>{q.note}</div>}

        <div className="mt-6 text-xs text-gray-600">
          This is a quotation, not a tax invoice. Prices are subject to availability. Generated by CartPOS on {generatedAt.toLocaleString()}.
        </div>
      </div>
    </div>
  )
}
