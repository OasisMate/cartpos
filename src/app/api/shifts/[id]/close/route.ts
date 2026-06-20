import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { canViewReports, UnauthorizedResponse, ForbiddenResponse, NotFoundResponse } from '@/lib/permissions'
import { logActivity, ActivityActions, EntityTypes } from '@/lib/audit/activityLog'
import { closeShift } from '@/lib/domain/shifts'
import { prisma } from '@/lib/db/prisma'

// POST: close a drawer { countedCash, note? }. Opener can close their own; managers can force-close any.
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser()
    if (!user) return UnauthorizedResponse()
    if (!user.currentShopId) return NextResponse.json({ error: 'No shop selected' }, { status: 400 })

    const shift = await prisma.shift.findUnique({
      where: { id: params.id },
      select: { id: true, shopId: true, openedById: true, status: true },
    })
    if (!shift || shift.shopId !== user.currentShopId) return NotFoundResponse('Drawer not found')

    const isOwner = shift.openedById === user.id
    if (!isOwner && !canViewReports(user, user.currentShopId)) {
      return ForbiddenResponse('Only a manager can close another cashier\'s drawer')
    }

    const body = await request.json()
    const countedCash = Number(body.countedCash)
    if (!Number.isFinite(countedCash) || countedCash < 0) {
      return NextResponse.json({ error: 'Enter the counted cash (zero or more)' }, { status: 400 })
    }

    const closed = await closeShift(params.id, user.id, countedCash, body.note)

    if (user.currentOrgId) {
      await logActivity({
        userId: user.id,
        orgId: user.currentOrgId,
        shopId: user.currentShopId,
        action: ActivityActions.CLOSE_SHIFT,
        entityType: EntityTypes.SHIFT,
        entityId: closed.id,
        details: {
          expectedCash: Number(closed.expectedCash),
          countedCash: Number(closed.countedCash),
          variance: Number(closed.variance),
          forced: !isOwner,
        },
        ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
        userAgent: request.headers.get('user-agent') || null,
      })
    }

    return NextResponse.json({ shift: closed })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to close drawer' }, { status: 400 })
  }
}
