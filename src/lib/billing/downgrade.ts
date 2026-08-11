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
 * Apply a plan change in EITHER direction, in one transaction.
 *
 * Pausing and restoring have to happen together. When they were two calls, the
 * caller ran the restore straight after the downgrade and it un-paused the very
 * seats the downgrade had just paused. Doing both here, in order, against the
 * new allowance, makes that impossible.
 *
 * Throws rather than guessing if the shop selection does not fit: silently
 * keeping the wrong branch is far worse than an error.
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
    // ---- 1. Pause what no longer fits -------------------------------
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

    // ---- 2. Restore what the NEW plan now covers ---------------------
    // Runs after the pause, and strictly within the new allowance, so on a
    // downgrade there is no room left and nothing comes back.
    const shopAllowance =
      plan.maxShops === null ? Infinity : plan.maxShops + subscription.extraShops
    const activeShops = await tx.shop.count({ where: { orgId: params.orgId, isActive: true } })
    const shopRoom = shopAllowance === Infinity ? Number.MAX_SAFE_INTEGER : Math.max(0, shopAllowance - activeShops)

    let restoredShops = 0
    if (shopRoom > 0) {
      // Only ever un-pauses PLAN_DOWNGRADE. A shop the owner closed themselves
      // stays closed: paying more is not consent to reopen it.
      const parked = await tx.shop.findMany({
        where: { orgId: params.orgId, isActive: false, pausedReason: 'PLAN_DOWNGRADE' },
        orderBy: { pausedAt: 'asc' },
        select: { id: true },
        take: shopRoom,
      })
      if (parked.length) {
        await tx.shop.updateMany({
          where: { id: { in: parked.map((s) => s.id) } },
          data: { isActive: true, pausedAt: null, pausedReason: null, pausedBy: null },
        })
        restoredShops = parked.length
      }
    }

    let restoredSeats = 0
    if (plan.maxUsers === null) {
      // Unlimited: everything comes back.
      const res = await tx.userShop.updateMany({
        where: { shop: { orgId: params.orgId }, isActive: false },
        data: { isActive: true, pausedAt: null },
      })
      restoredSeats = res.count
    } else {
      const active = await tx.userShop.findMany({
        where: { shop: { orgId: params.orgId }, isActive: true },
        select: { userId: true },
      })
      const seatRoom = Math.max(0, plan.maxUsers - new Set(active.map((a) => a.userId)).size)
      if (seatRoom > 0) {
        const parked = await tx.userShop.findMany({
          where: { shop: { orgId: params.orgId }, isActive: false },
          orderBy: { pausedAt: 'asc' },
          select: { userId: true },
        })
        const users = [...new Set(parked.map((p) => p.userId))].slice(0, seatRoom)
        if (users.length) {
          const res = await tx.userShop.updateMany({
            where: { userId: { in: users }, shop: { orgId: params.orgId } },
            data: { isActive: true, pausedAt: null },
          })
          restoredSeats = res.count
        }
      }
    }

    return {
      subscription,
      pausedShops: toPause.length,
      pausedSeats: impact.seatsToPause.length,
      restoredShops,
      restoredSeats,
    }
  })
}

/**
 * Restore what a bigger plan now covers, without changing the plan itself.
 *
 * Only needed when the allowance grows for a reason other than a plan change,
 * for example an admin adding paid extra shops. A normal plan change should use
 * applyDowngrade, which pauses and restores in one transaction.
 *
 * NEVER call this straight after applyDowngrade. Doing so was a real bug: it
 * un-paused the seats the downgrade had just paused.
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

  return prisma.$transaction(async (tx) => {
    if (restore.length > 0) {
      await tx.shop.updateMany({
        where: { id: { in: restore } },
        data: { isActive: true, pausedAt: null, pausedReason: null, pausedBy: null },
      })
    }

    // Seats, respecting the cap. Restoring blindly here would let an org exceed
    // the seats it pays for.
    let restoredSeats = 0
    if (plan.maxUsers === null) {
      const res = await tx.userShop.updateMany({
        where: { shop: { orgId }, isActive: false },
        data: { isActive: true, pausedAt: null },
      })
      restoredSeats = res.count
    } else {
      const active = await tx.userShop.findMany({
        where: { shop: { orgId }, isActive: true },
        select: { userId: true },
      })
      const seatRoom = Math.max(0, plan.maxUsers - new Set(active.map((a) => a.userId)).size)
      if (seatRoom > 0) {
        const parked = await tx.userShop.findMany({
          where: { shop: { orgId }, isActive: false },
          orderBy: { pausedAt: 'asc' },
          select: { userId: true },
        })
        const users = [...new Set(parked.map((p) => p.userId))].slice(0, seatRoom)
        if (users.length) {
          const res = await tx.userShop.updateMany({
            where: { userId: { in: users }, shop: { orgId } },
            data: { isActive: true, pausedAt: null },
          })
          restoredSeats = res.count
        }
      }
    }

    return { restoredShops: restore.length, restoredSeats }
  })
}
