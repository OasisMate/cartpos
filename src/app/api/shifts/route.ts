import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { canMakeSales, canViewReports, UnauthorizedResponse, ForbiddenResponse } from '@/lib/permissions'
import { logActivity, ActivityActions, EntityTypes } from '@/lib/audit/activityLog'
import { openShift, listShifts } from '@/lib/domain/shifts'

// GET: list shifts for the current shop (manager view). Optional ?status=OPEN|CLOSED&mine=1
export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return UnauthorizedResponse()
  if (!user.currentShopId) return NextResponse.json({ error: 'No shop selected' }, { status: 400 })

  const url = new URL(request.url)
  const statusParam = url.searchParams.get('status')
  const mine = url.searchParams.get('mine') === '1'

  // Anyone with shop access can list their own drawers; the full shop list is manager-only.
  if (!mine && !canViewReports(user, user.currentShopId)) {
    return ForbiddenResponse('Only managers can view all drawers')
  }
  if (mine && !canMakeSales(user, user.currentShopId)) {
    return ForbiddenResponse('No access to this shop')
  }

  const status = statusParam === 'OPEN' || statusParam === 'CLOSED' ? statusParam : undefined
  const shifts = await listShifts(user.currentShopId, {
    status,
    openedById: mine ? user.id : undefined,
  })
  return NextResponse.json({ shifts })
}

// POST: open a drawer { openingFloat, label? }
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return UnauthorizedResponse()
    if (!user.currentShopId) return NextResponse.json({ error: 'No shop selected' }, { status: 400 })
    if (!canMakeSales(user, user.currentShopId)) {
      return ForbiddenResponse('You do not have access to this shop')
    }

    const body = await request.json()
    const openingFloat = Number(body.openingFloat)
    if (!Number.isFinite(openingFloat) || openingFloat < 0) {
      return NextResponse.json({ error: 'Opening float must be zero or more' }, { status: 400 })
    }

    const shift = await openShift(user.currentShopId, user.id, openingFloat, body.label)

    if (user.currentOrgId) {
      await logActivity({
        userId: user.id,
        orgId: user.currentOrgId,
        shopId: user.currentShopId,
        action: ActivityActions.OPEN_SHIFT,
        entityType: EntityTypes.SHIFT,
        entityId: shift.id,
        details: { openingFloat: Number(shift.openingFloat), label: shift.label },
        ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
        userAgent: request.headers.get('user-agent') || null,
      })
    }

    return NextResponse.json({ shift }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to open drawer' }, { status: 400 })
  }
}
