import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { canMakeSales, UnauthorizedResponse, ForbiddenResponse } from '@/lib/permissions'
import { getOpenShift, computeExpectedCash } from '@/lib/domain/shifts'
import { prisma } from '@/lib/db/prisma'

// GET: the caller's currently-open drawer for the current shop + live expected cash (X-report read).
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return UnauthorizedResponse()
  if (!user.currentShopId) return NextResponse.json({ error: 'No shop selected' }, { status: 400 })
  if (!canMakeSales(user, user.currentShopId)) return ForbiddenResponse('No access to this shop')

  const shift = await getOpenShift(prisma, user.currentShopId, user.id)
  if (!shift) return NextResponse.json({ shift: null })

  const breakdown = await computeExpectedCash(shift.id)
  return NextResponse.json({
    shift: {
      id: shift.id,
      label: shift.label,
      openingFloat: Number(shift.openingFloat),
      openedAt: shift.openedAt,
    },
    breakdown,
  })
}
