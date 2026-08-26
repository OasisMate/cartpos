import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db/prisma'
import { reserveDocumentNumbers, MAX_RESERVATION } from '@/lib/domain/documentNumbers'
import { canMakeSales, UnauthorizedResponse, ForbiddenResponse } from '@/lib/permissions'

/**
 * Hands this device a block of invoice numbers to use offline.
 *
 * Deliberately NOT behind requirePaidWrite: reserving numbers is not a write the shop can see,
 * and a POS that cannot get numbers cannot print a correct receipt for the sales it is still
 * allowed to make. The paywall is enforced where the sale itself is posted.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return UnauthorizedResponse()
    if (!user.currentShopId) {
      return NextResponse.json({ error: 'No shop selected' }, { status: 400 })
    }
    if (!canMakeSales(user, user.currentShopId)) {
      return ForbiddenResponse('You do not have permission to access POS')
    }

    const body = await request.json().catch(() => ({}))
    const requested = Number(body?.count)
    const count = Number.isInteger(requested)
      ? Math.min(MAX_RESERVATION, Math.max(1, requested))
      : 50

    const block = await reserveDocumentNumbers(prisma, user.currentShopId, 'INVOICE', count)

    return NextResponse.json({ ...block, shopId: user.currentShopId })
  } catch (error: any) {
    console.error('Reserve invoice numbers error:', error)
    return NextResponse.json({ error: 'Failed to reserve invoice numbers' }, { status: 500 })
  }
}
