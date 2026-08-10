import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getCurrentUser } from '@/lib/auth'
import { logActivity, ActivityActions, EntityTypes } from '@/lib/audit/activityLog'

/**
 * Open or close a shop.
 *
 * A closed shop is READ-ONLY, not deleted and not hidden: staff can still log
 * in, see the banner and read history, but every write is refused. Serves two
 * jobs with one flag - an owner closing for renovation or a dispute
 * (OWNER_CLOSED), and a plan downgrade parking an extra shop (PLAN_DOWNGRADE).
 * Only the owner can undo the first; only paying undoes the second.
 *
 * ORG_ADMIN only. A store manager must not be able to lock their own shop, and
 * must never be able to reopen one the owner deliberately closed.
 */
function ensureOrgAdmin(user: any) {
  const isOrgAdmin = user?.organizations?.some(
    (o: any) => o.orgId === user.currentOrgId && o.orgRole === 'ORG_ADMIN'
  )
  if (!isOrgAdmin && user?.role !== 'PLATFORM_ADMIN') {
    throw new Error('FORBIDDEN')
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    ensureOrgAdmin(user)
  } catch {
    return NextResponse.json(
      { error: 'Only the organisation owner can open or close a shop' },
      { status: 403 }
    )
  }

  const storeId = params.id
  const orgId = user.currentOrgId
  if (!orgId) return NextResponse.json({ error: 'No organization selected' }, { status: 400 })

  try {
    const body = await request.json().catch(() => ({}))
    const isActive = Boolean(body?.isActive)
    const reason = typeof body?.reason === 'string' ? body.reason.slice(0, 200) : null

    const shop = await prisma.shop.findFirst({
      where: { id: storeId, orgId },
      select: { id: true, name: true, isActive: true, pausedReason: true },
    })
    if (!shop) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

    if (shop.isActive === isActive) {
      return NextResponse.json({ store: shop, unchanged: true })
    }

    // ---- Closing ----------------------------------------------------
    if (!isActive) {
      // An open drawer holds counted cash that only the cashier can reconcile.
      // Freezing the shop underneath them would strand that money and leave a
      // shift that can never be closed, so refuse and say exactly who to chase.
      const openShifts = await prisma.shift.findMany({
        where: { shopId: storeId, status: 'OPEN' },
        select: {
          id: true,
          label: true,
          openingFloat: true,
          openedAt: true,
          openedBy: { select: { name: true } },
        },
      })

      if (openShifts.length > 0) {
        return NextResponse.json(
          {
            error: 'OPEN_SHIFTS',
            message:
              openShifts.length === 1
                ? `${openShifts[0].openedBy?.name ?? 'A cashier'} still has an open cash drawer. Close it first, then close the shop.`
                : `${openShifts.length} cash drawers are still open. Close them first, then close the shop.`,
            openShifts: openShifts.map((s) => ({
              id: s.id,
              label: s.label,
              cashier: s.openedBy?.name ?? null,
              openingFloat: Number(s.openingFloat),
              openedAt: s.openedAt,
            })),
          },
          { status: 409 }
        )
      }
    }

    // ---- Reopening ---------------------------------------------------
    // A shop parked by a downgrade is not the owner's to reopen: the seat is
    // simply not paid for. Sending them to billing is the honest answer.
    if (isActive && shop.pausedReason === 'PLAN_DOWNGRADE') {
      return NextResponse.json(
        {
          error: 'PLAN_LIMIT',
          message:
            'This shop is paused because your plan does not cover it. Upgrade your plan to reopen it.',
        },
        { status: 402 }
      )
    }

    const updated = await prisma.shop.update({
      where: { id: storeId },
      data: isActive
        ? { isActive: true, pausedAt: null, pausedReason: null, pausedBy: null }
        : {
            isActive: false,
            pausedAt: new Date(),
            pausedReason: 'OWNER_CLOSED',
            pausedBy: user.id,
          },
      select: { id: true, name: true, isActive: true, pausedAt: true, pausedReason: true },
    })

    await logActivity({
      userId: user.id,
      orgId,
      shopId: storeId,
      action: ActivityActions.TOGGLE_SHOP_ACTIVE,
      entityType: EntityTypes.STORE,
      entityId: storeId,
      details: { name: shop.name, isActive, reason },
    })

    return NextResponse.json({ store: updated })
  } catch (error) {
    console.error('Toggle shop active error:', error)
    return NextResponse.json({ error: 'Failed to update shop' }, { status: 500 })
  }
}
