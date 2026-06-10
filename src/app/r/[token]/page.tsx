import { notFound } from 'next/navigation'
import { verifyReceiptToken } from '@/lib/receipt-token'
import { prisma } from '@/lib/db/prisma'
import ReceiptDocument from '@/components/receipt/ReceiptDocument'
import PrintButton from '@/components/suppliers/PrintButton'

export const dynamic = 'force-dynamic'

export default async function PublicReceiptPage({
  params,
}: {
  params: { token: string }
}) {
  const invoiceId = await verifyReceiptToken(params.token)
  if (!invoiceId) return notFound()

  // Public, no-login view: select ONLY customer-safe fields.
  // No cost, no profit/margin, no other invoices, no account ledger.
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: {
      id: true,
      number: true,
      status: true,
      paymentStatus: true,
      paymentMethod: true,
      subtotal: true,
      discount: true,
      total: true,
      createdAt: true,
      customer: { select: { name: true } },
      payments: { select: { amount: true } },
      lines: {
        select: {
          id: true,
          quantity: true,
          unitPrice: true,
          lineTotal: true,
          product: { select: { name: true } },
        },
      },
      shop: {
        select: {
          name: true,
          city: true,
          phone: true,
          addressLine1: true,
          addressLine2: true,
          settings: { select: { logoUrl: true, receiptHeaderDisplay: true } },
        },
      },
    },
  })

  if (!invoice) return notFound()

  // Map to the shared ReceiptDocument shape — the EXACT printed receipt design.
  const doc = {
    id: invoice.id,
    number: invoice.number ?? undefined,
    createdAt: invoice.createdAt.toISOString(),
    shop: invoice.shop
      ? {
          name: invoice.shop.name,
          city: invoice.shop.city,
          phone: invoice.shop.phone,
          addressLine1: invoice.shop.addressLine1,
          addressLine2: invoice.shop.addressLine2,
          settings: invoice.shop.settings
            ? {
                logoUrl: invoice.shop.settings.logoUrl,
                receiptHeaderDisplay: invoice.shop.settings.receiptHeaderDisplay as
                  | 'NAME_ONLY'
                  | 'LOGO_ONLY'
                  | 'BOTH',
              }
            : null,
        }
      : null,
    lines: invoice.lines.map((l) => ({
      id: l.id,
      product: { name: l.product.name },
      quantity: Number(l.quantity),
      unitPrice: Number(l.unitPrice),
      lineTotal: Number(l.lineTotal),
    })),
    subtotal: Number(invoice.subtotal),
    discount: Number(invoice.discount),
    total: Number(invoice.total),
    paymentStatus: (invoice.paymentStatus === 'UDHAAR' ? 'UDHAAR' : 'PAID') as 'PAID' | 'UDHAAR',
    paymentMethod: invoice.paymentMethod as 'CASH' | 'CARD' | 'OTHER' | null,
    payments: invoice.payments.map((p) => ({ amount: Number(p.amount) })),
    customer: { name: invoice.customer?.name ?? null },
  }

  const isVoid = invoice.status === 'VOID'

  return (
    <div className="min-h-screen bg-gray-100 py-6 px-4 flex flex-col items-center">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #public-receipt, #public-receipt * { visibility: visible; }
          #public-receipt { position: absolute; left: 0; top: 0; right: 0; margin: 0 auto; width: 80mm; }
          .no-print { display: none !important; }
          @page { size: 80mm auto; margin: 4mm; }
        }
      `}</style>

      <div className="no-print w-full max-w-sm mb-3 flex justify-end">
        <PrintButton />
      </div>

      {isVoid && (
        <div className="no-print w-full max-w-sm mb-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-center text-sm font-semibold text-red-700">
          This invoice was cancelled.
        </div>
      )}

      <div className="w-full max-w-sm bg-white rounded-lg shadow-sm p-5">
        <ReceiptDocument invoice={doc} id="public-receipt" />
      </div>

      <div className="no-print mt-4 text-xs text-gray-400">Powered by CartPOS</div>
    </div>
  )
}
