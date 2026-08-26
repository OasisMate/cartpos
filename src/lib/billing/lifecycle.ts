/**
 * Moving subscriptions through their states as deadlines pass.
 *
 * The stored `status` is a convenience for listing and filtering, NOT the
 * source of truth for access. resolveBillingState always recomputes against
 * the current date, so a shop is never wrongly locked out just because this
 * sweep has not run. That means this can run on a cron, on demand, or never,
 * without changing what anyone is allowed to do.
 */
import { prisma } from '@/lib/db/prisma'
import { GRACE_DAYS } from './subscription'
import { sendOrgSuspendedWarningEmail } from '../domain/organizations'

/** Written to suspensionReason so the admin list explains itself. */
const SUSPEND_REASON = 'Trial or subscription ended with no payment received'

/** Stands in for an admin id in the audit trail when the cron acts on its own. */
const SYSTEM_ACTOR = 'system:billing-sweep'

const DAY_MS = 24 * 60 * 60 * 1000

export interface SweepResult {
  toPastDue: number
  toExpired: number
  /** Orgs moved to SUSPENDED because they never paid. */
  suspended: number
  checked: number
}

/**
 * Bring stored statuses in line with today's date.
 *
 * TRIALING/ACTIVE past their deadline -> PAST_DUE
 * PAST_DUE more than GRACE_DAYS past it -> EXPIRED
 *
 * Never touches a subscription with no deadline (grandfathered) or a CANCELLED
 * one.
 */
export async function sweepSubscriptions(now = new Date()): Promise<SweepResult> {
  const graceCutoff = new Date(now.getTime() - GRACE_DAYS * DAY_MS)

  const candidates = await prisma.subscription.findMany({
    where: {
      status: { in: ['TRIALING', 'ACTIVE', 'PAST_DUE'] },
      // Demo and free-access orgs are outside billing entirely. Already
      // suspended orgs have nothing left to do here.
      organization: { isDemo: false, billingExempt: false, status: { not: 'SUSPENDED' } },
      OR: [{ trialEndsAt: { not: null } }, { currentPeriodEnd: { not: null } }],
    },
    select: {
      id: true,
      status: true,
      trialEndsAt: true,
      currentPeriodEnd: true,
      organizationId: true,
    },
  })

  const toPastDue: string[] = []
  const toExpired: string[] = []
  // Expiring is not enough: an org that never paid gets suspended, which is what
  // actually stops them using the service.
  const toSuspend: string[] = []

  for (const sub of candidates) {
    // Which field is the deadline depends on status. Reading the wrong one
    // would expire a paying customer the moment their trial date passed.
    //
    // The fallback to trialEndsAt matters: once this sweep moves a trial to
    // PAST_DUE its currentPeriodEnd is still null, so reading only that field
    // made the row invisible here forever and it could never reach EXPIRED.
    const deadline =
      sub.status === 'TRIALING' ? sub.trialEndsAt : sub.currentPeriodEnd ?? sub.trialEndsAt
    if (!deadline) continue

    if (deadline > now) continue

    if (deadline < graceCutoff) {
      if (sub.status !== 'EXPIRED') toExpired.push(sub.id)
      toSuspend.push(sub.organizationId)
    } else if (sub.status !== 'PAST_DUE') {
      toPastDue.push(sub.id)
    }
  }

  if (toPastDue.length) {
    await prisma.subscription.updateMany({ where: { id: { in: toPastDue } }, data: { status: 'PAST_DUE' } })
  }
  if (toExpired.length) {
    await prisma.subscription.updateMany({ where: { id: { in: toExpired } }, data: { status: 'EXPIRED' } })
  }

  let suspended = 0
  if (toSuspend.length) {
    const result = await prisma.organization.updateMany({
      where: { id: { in: toSuspend }, status: 'ACTIVE' },
      data: { status: 'SUSPENDED', suspensionReason: SUSPEND_REASON },
    })
    suspended = result.count

    // Tell them why, one email per org, after the status is written so a failed
    // send cannot leave an org suspended with no explanation pending.
    for (const orgId of toSuspend) {
      await sendOrgSuspendedWarningEmail(orgId, SYSTEM_ACTOR, SUSPEND_REASON)
    }
  }

  return {
    toPastDue: toPastDue.length,
    toExpired: toExpired.length,
    suspended,
    checked: candidates.length,
  }
}

/**
 * Swap which single shop a one-shop plan is using.
 *
 * Limited to once per billing period so it cannot be used to run two shops off
 * one subscription by flipping daily. Everything is paused, never deleted, so a
 * swap is fully reversible next period or on upgrade.
 */
export async function swapActiveShop(params: {
  orgId: string
  activateShopId: string
  userId: string
  now?: Date
}) {
  const now = params.now ?? new Date()

  const sub = await prisma.subscription.findUnique({
    where: { organizationId: params.orgId },
    include: { plan: true },
  })
  if (!sub) throw new Error('No subscription for this organisation')

  const allowance = sub.plan.maxShops === null ? Infinity : sub.plan.maxShops + sub.extraShops
  if (allowance === Infinity || allowance > 1) {
    throw new Error('Your plan already covers more than one shop, so there is nothing to swap.')
  }

  // Period start is whichever deadline governs, minus nothing: we just check
  // the swap has not already been used since the last renewal.
  if (sub.shopSwapUsedAt) {
    const periodStart = sub.currentPeriodEnd
      ? new Date(sub.currentPeriodEnd.getTime() - 30 * DAY_MS)
      : new Date(now.getTime() - 30 * DAY_MS)
    if (sub.shopSwapUsedAt > periodStart) {
      throw new Error(
        'You have already switched shops this billing period. You can switch again next period, or upgrade to run both.'
      )
    }
  }

  const target = await prisma.shop.findFirst({
    where: { id: params.activateShopId, orgId: params.orgId },
    select: { id: true, name: true, isActive: true, pausedReason: true },
  })
  if (!target) throw new Error('Shop not found')
  if (target.isActive) throw new Error('That shop is already the active one')
  if (target.pausedReason === 'OWNER_CLOSED') {
    throw new Error('That shop was closed by you. Reopen it from the shops page instead.')
  }

  return prisma.$transaction(async (tx) => {
    // Park everything else that a downgrade left active.
    await tx.shop.updateMany({
      where: { orgId: params.orgId, isActive: true },
      data: { isActive: false, pausedAt: now, pausedReason: 'PLAN_DOWNGRADE', pausedBy: params.userId },
    })

    const activated = await tx.shop.update({
      where: { id: params.activateShopId },
      data: { isActive: true, pausedAt: null, pausedReason: null, pausedBy: null },
      select: { id: true, name: true },
    })

    await tx.subscription.update({
      where: { id: sub.id },
      data: { shopSwapUsedAt: now },
    })

    return activated
  })
}
