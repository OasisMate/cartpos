import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { canViewReports, UnauthorizedResponse, ForbiddenResponse, NotFoundResponse } from '@/lib/permissions'
import { getShiftDetail } from '@/lib/domain/shifts'

// GET: full detail for one drawer (record + manual movements + live expected cash).
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user) return UnauthorizedResponse()
  if (!user.currentShopId) return NextResponse.json({ error: 'No shop selected' }, { status: 400 })

  const detail = await getShiftDetail(params.id)
  if (!detail || detail.shift.shopId !== user.currentShopId) return NotFoundResponse('Drawer not found')

  // The opener can see their own drawer; managers can see any drawer in the shop.
  const isOwner = detail.shift.openedById === user.id
  if (!isOwner && !canViewReports(user, user.currentShopId)) {
    return ForbiddenResponse('Only managers can view other drawers')
  }

  return NextResponse.json(detail)
}
