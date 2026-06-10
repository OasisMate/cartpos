import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db/prisma'
import { signReceiptToken } from '@/lib/receipt-token'

/**
 * Issue a signed public-receipt token for an invoice, plus the customer's phone
 * (for prefilling the WhatsApp recipient). Scoped to the caller's current shop.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    if (!user.currentShopId) {
      return NextResponse.json({ error: 'No shop selected' }, { status: 400 })
    }

    // Resolve by DB invoice id (sales list) OR client sale id (POS post-checkout
    // passes the offline cuid). Always scoped to the caller's current shop.
    const invoice = await prisma.invoice.findFirst({
      where: {
        shopId: user.currentShopId,
        OR: [{ id: params.id }, { clientSaleId: params.id }],
      },
      select: { id: true, customer: { select: { phone: true } } },
    })

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    const token = await signReceiptToken(invoice.id)
    return NextResponse.json({ token, customerPhone: invoice.customer?.phone ?? null })
  } catch (error: any) {
    console.error('Receipt share error:', error)
    return NextResponse.json({ error: error.message || 'Failed to create share link' }, { status: 500 })
  }
}
