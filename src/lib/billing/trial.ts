/**
 * Trial policy, in one place so signup, the PENDING migration and admin all
 * agree on the length.
 *
 * 14 days on the top tier. Giving them everything and letting them feel it beats
 * a crippled trial that never shows why the paid tiers are worth anything: the
 * whole point is that they experience the product, then choose.
 */
import { prisma } from '@/lib/db/prisma'
import type { Prisma } from '@prisma/client'

export const TRIAL_DAYS = 14

/** The tier a trial runs on. Everything unlocked. */
export const TRIAL_PLAN_CODE = 'BUSINESS'

export function trialEndFrom(start: Date = new Date()): Date {
  return new Date(start.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000)
}

/**
 * Build the Subscription create payload for a brand-new org.
 *
 * `agreedMonthlyPrice` is snapshotted from the plan now, not read live later.
 * That is what makes grandfathering automatic: raise prices next year and every
 * existing customer keeps the number they signed up on.
 *
 * Returns null when the plan table has not been seeded, so signup can carry on
 * without a subscription rather than failing. resolveBillingState treats a
 * missing subscription as full access.
 */
export async function buildTrialSubscription(
  tx: Prisma.TransactionClient,
  now: Date = new Date()
): Promise<Omit<Prisma.SubscriptionUncheckedCreateInput, 'organizationId'> | null> {
  const plan = await tx.plan.findUnique({
    where: { code: TRIAL_PLAN_CODE },
    select: { id: true, monthlyPrice: true },
  })
  if (!plan) return null

  return {
    planId: plan.id,
    status: 'TRIALING',
    cycle: 'MONTHLY',
    agreedMonthlyPrice: plan.monthlyPrice,
    trialEndsAt: trialEndFrom(now),
    // TRIALING is bounded by trialEndsAt; currentPeriodEnd only starts counting
    // once they actually pay for a period.
    currentPeriodEnd: null,
  }
}

/**
 * Start (or restart) a 14-day trial for an org that already exists.
 *
 * Used when activating the orgs that were stuck on PENDING before approval was
 * dropped: their clock starts when they can first log in, not when they signed
 * up, so nobody loses trial days waiting on us.
 */
export async function startTrialForOrg(orgId: string, now: Date = new Date()) {
  const plan = await prisma.plan.findUnique({
    where: { code: TRIAL_PLAN_CODE },
    select: { id: true, monthlyPrice: true },
  })
  if (!plan) return null

  const trialEndsAt = trialEndFrom(now)
  return prisma.subscription.upsert({
    where: { organizationId: orgId },
    create: {
      organizationId: orgId,
      planId: plan.id,
      status: 'TRIALING',
      cycle: 'MONTHLY',
      agreedMonthlyPrice: plan.monthlyPrice,
      trialEndsAt,
      currentPeriodEnd: null,
    },
    update: {
      planId: plan.id,
      status: 'TRIALING',
      trialEndsAt,
      currentPeriodEnd: null,
    },
  })
}
