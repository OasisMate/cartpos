/**
 * Moving to a smaller plan, and what happens to what no longer fits.
 *
 * GOVERNING RULE: nothing is ever deleted, and we never choose for them.
 *
 * A shop can finish a full-access trial with three shops and five staff, then
 * pick Solo. The excess has to go somewhere, and the only acceptable answer is
 * "paused, reversibly, after you told us which to keep". Picking the oldest
 * shop automatically is how you switch off someone's main branch.
 *
 * Not paying is NOT a downgrade. An expired org goes read-only with everything
 * still visible; nothing is paused until they actively choose a smaller plan.
 */
import { prisma } from '@/lib/db/prisma'

export interface DowngradeImpact {
  planCode: string
  planName: string
  /** Shops beyond the new allowance. They must choose which stay. */
  mustChooseShops: boolean
  shopAllowance: number | null
  activeShops: Array<{ id: string; name: string; city: string | null; invoices: number }>
  /** Seats beyond the new cap. The owner is always kept, so no choice needed. */
  seatsToPause: Array<{ userId: string; name: string; email: string; role: string }>
  seatAllowance: number | null
  losesOrgLevel: boolean
}

/** What would happen if this org moved to `planCode`. Read-only. */
export async function previewDowngrade(orgId: string, planCode: string): Promise<DowngradeImpact> {
  const [plan, org] = await Promise.all([
    prisma.plan.findUniqueOrThrow({ where: { code: planCode } }),
    prisma.organization.findUniqueOrThrow({
      where: { id: orgId },
      select: {
        subscription: { select: { extraShops: true, plan: { select: { allowOrgLevel: true } } } },
        users: { select: { userId: true } },
      },
    }),
  ])

  const shopAllowance = plan.maxShops === null ? null : plan.maxShops + (org.subscription?.extraShops ?? 0)

  const shops = await prisma.shop.findMany({
    where: { orgId, isActive: true },
    select: { id: true, name: true, city: true, _count: { select: { invoices: true } } },
    // Busiest first: it is almost always the one they mean to keep, so it is
    // the sensible default selection in the UI.
    orderBy: { invoices: { _count: 'desc' } },
  })

  const seats = await prisma.userShop.findMany({
    where: { shop: { orgId }, isActive: true },
    select: {
      userId: true,
      shopRole: true,
      user: { select: { name: true, email: true } },
    },
  })

  // The org admin pays the bill, so their seat is never the one removed.
  const ownerIds = new Set(org.users.map((u) => u.userId))
  const distinct = new Map<string, { userId: string; name: string; email: string; role: string }>()
  for (const s of seats) {
    if (!distinct.has(s.userId)) {
      distinct.set(s.userId, {
        userId: s.userId,
        name: s.user.name,
        email: s.user.email,
        role: s.shopRole,
      })
    }
  }

  const owners = [...distinct.values()].filter((u) => ownerIds.has(u.userId))
  const staff = [...distinct.values()].filter((u) => !ownerIds.has(u.userId))

  let seatsToPause: typeof staff = []
  if (plan.maxUsers !== null) {
    const room = Math.max(0, plan.maxUsers - owners.length)
    // Keep the earliest-added staff, pause the newest. Arbitrary but stable,
    // and it never touches an owner.
    seatsToPause = staff.slice(room)
  }

  return {
    planCode: plan.code,
    planName: plan.name,
    shopAllowance,
    mustChooseShops: shopAllowance !== null && shops.length > shopAllowance,
    activeShops: shops.map((s) => ({
      id: s.id,
      name: s.name,
      city: s.city,
      invoices: s._count.invoices,
    })),
    seatsToPause,
    seatAllowance: plan.maxUsers,
    losesOrgLevel: Boolean(org.subscription?.plan?.allowOrgLevel) && !plan.allowOrgLevel,
  }
}

/**
 * Apply a downgrade once the owner has said which shops to keep.
 *
 * Throws rather than guessing if the selection does not fit: silently keeping
 * the wrong branch is far worse than an error.
 */
export async function applyDowngrade(params: {
  orgId: string
  planCode: string
  keepShopIds: string[]
  setBy: string
}) {
  const impact = await previewDowngrade(params.orgId, params.planCode)
  const plan = await prisma.plan.findUniqueOrThrow({ where: { code: params.planCode } })

  if (impact.shopAllowance !== null) {
    if (params.keepShopIds.length > impact.shopAllowance) {
      throw new Error(`${impact.planName} covers ${impact.shopAllowance} shop(s). Choose fewer.`)
    }
    if (impact.mustChooseShops && params.keepShopIds.length === 0) {
      throw new Error('Choose which shop stays active.')
    }
  }

  const keep = new Set(params.keepShopIds)
  const toPause = impact.activeShops.filter((s) => !keep.has(s.id)).map((s) => s.id)
  const now = new Date()

  return prisma.$transaction(async (tx) => {
    if (toPause.length > 0) {
      await tx.shop.updateMany({
        where: { id: { in: toPause } },
        data: { isActive: false, pausedAt: now, pausedReason: 'PLAN_DOWNGRADE', pausedBy: params.setBy },
      })
    }

    if (impact.seatsToPause.length > 0) {
      await tx.userShop.updateMany({
        where: { userId: { in: impact.seatsToPause.map((s) => s.userId) }, shop: { orgId: params.orgId } },
        data: { isActive: false, pausedAt: now },
      })
    }

    const subscription = await tx.subscription.update({
      where: { organizationId: params.orgId },
      data: { planId: plan.id, agreedMonthlyPrice: plan.monthlyPrice, priceSetBy: params.setBy },
      include: { plan: true },
    })

    return { subscription, pausedShops: toPause.length, pausedSeats: impact.seatsToPause.length }
  })
}

/**
 * Undo a downgrade's pauses when the org moves back up.
 *
 * Only touches PLAN_DOWNGRADE. A shop the owner deliberately closed stays
 * closed: upgrading is not consent to reopen it.
 */
export async function reactivateAfterUpgrade(orgId: string, planCode: string) {
  const plan = await prisma.plan.findUniqueOrThrow({ where: { code: planCode } })
  const sub = await prisma.subscription.findUnique({
    where: { organizationId: orgId },
    select: { extraShops: true },
  })
  const allowance = plan.maxShops === null ? Infinity : plan.maxShops + (sub?.extraShops ?? 0)

  const activeCount = await prisma.shop.count({ where: { orgId, isActive: true } })
  const paused = await prisma.shop.findMany({
    where: { orgId, isActive: false, pausedReason: 'PLAN_DOWNGRADE' },
    orderBy: { pausedAt: 'asc' },
    select: { id: true },
  })

  const room = Math.max(0, allowance === Infinity ? paused.length : allowance - activeCount)
  const restore = paused.slice(0, room).map((s) => s.id)

  const now = new Date()
  return prisma.$transaction(async (tx) => {
    if (restore.length > 0) {
      await tx.shop.updateMany({
        where: { id: { in: restore } },
        data: { isActive: true, pausedAt: null, pausedReason: null, pausedBy: null },
      })
    }
    // Seats have no reason column; all paused ones belong to a downgrade.
    const seats = await tx.userShop.updateMany({
      where: { shop: { orgId }, isActive: false },
      data: { isActive: true, pausedAt: null },
    })
    return { restoredShops: restore.length, restoredSeats: seats.count, at: now }
  })
}
