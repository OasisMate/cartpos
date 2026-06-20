import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { canViewReports, canMakeSales, UnauthorizedResponse, ForbiddenResponse, NotFoundResponse } from '@/lib/permissions'
import { logActivity, ActivityActions, EntityTypes } from '@/lib/audit/activityLog'
import { recordCashMovement } from '@/lib/domain/shifts'
import { prisma } from '@/lib/db/prisma'

const TYPES = ['PAY_IN', 'PAY_OUT', 'BANK_DROP', 'OWNER_DRAW', 'FLOAT_ADD', 'OTHER'] as const
type CashMoveType = (typeof TYPES)[number]

// Each movement type has a fixed direction so the drawer math can't be fed a contradictory sign.
const DIRECTION: Record<CashMoveType, 'IN' | 'OUT'> = {
  PAY_IN: 'IN',
  FLOAT_ADD: 'IN',
  PAY_OUT: 'OUT',
  BANK_DROP: 'OUT',
  OWNER_DRAW: 'OUT',
  OTHER: 'IN',
}

// POST: record a manual cash in/out on a drawer { type, amount, reason?, direction? }
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser()
    if (!user) return UnauthorizedResponse()
    if (!user.currentShopId) return NextResponse.json({ error: 'No shop selected' }, { status: 400 })
    if (!canMakeSales(user, user.currentShopId)) return ForbiddenResponse('No access to this shop')

    const shift = await prisma.shift.findUnique({
      where: { id: params.id },
      select: { id: true, shopId: true, openedById: true, status: true },
    })
    if (!shift || shift.shopId !== user.currentShopId) return NotFoundResponse('Drawer not found')
    if (shift.status === 'CLOSED') return NextResponse.json({ error: 'Drawer is closed' }, { status: 400 })

    const isOwner = shift.openedById === user.id
    if (!isOwner && !canViewReports(user, user.currentShopId)) {
      return ForbiddenResponse('Only a manager can adjust another cashier\'s drawer')
    }

    const body = await request.json()
    const type = (body.type as CashMoveType) || 'OTHER'
    if (!TYPES.includes(type)) return NextResponse.json({ error: 'Invalid movement type' }, { status: 400 })
    // OTHER honours an explicit direction; the rest are fixed.
    const direction: 'IN' | 'OUT' =
      type === 'OTHER' && (body.direction === 'IN' || body.direction === 'OUT') ? body.direction : DIRECTION[type]
    const amount = Number(body.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Amount must be greater than zero' }, { status: 400 })
    }

    const movement = await recordCashMovement(
      user.currentShopId,
      params.id,
      user.id,
      direction,
      type,
      amount,
      body.reason,
    )

    if (user.currentOrgId) {
      await logActivity({
        userId: user.id,
        orgId: user.currentOrgId,
        shopId: user.currentShopId,
        action: ActivityActions.CASH_MOVEMENT,
        entityType: EntityTypes.SHIFT,
        entityId: params.id,
        details: { direction, type, amount: Number(movement.amount), reason: movement.reason },
        ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
        userAgent: request.headers.get('user-agent') || null,
      })
    }

    return NextResponse.json({ movement }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to record cash movement' }, { status: 400 })
  }
}
