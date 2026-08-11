/**
 * Billing operations shared by the org-facing and admin-facing routes.
 *
 * Everything that moves money or changes access lives here so there is one
 * implementation of "record a payment" rather than one per screen.
 */
import { prisma } from '@/lib/db/prisma'
import type { BillingCycle, BillingPaymentMethod } from '@prisma/client'
import { extendPeriod, monthsFor, priceFor } from './cycles'
import { PLAN_FEATURES } from './features'

/** Plans a shop can actually buy, cheapest first. */
export async function listPlans() {
  return prisma.plan.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
  })
}

export async function getBillingSettings() {
  const row = await prisma.billingSettings.findUnique({ where: { id: 'default' } })
  return (
    row ?? {
      id: 'default',
      bankName: null,
      accountTitle: null,
      accountNumber: null,
      iban: null,
      raastId: null,
      jazzcashNumber: null,
      easypaisaNumber: null,
      whatsappNumber: null,
      supportEmail: null,
      instructions: null,
      updatedBy: null,
      updatedAt: new Date(),
    }
  )
}

export async function getSubscriptionForOrg(orgId: string) {
  return prisma.subscription.findUnique({
    where: { organizationId: orgId },
    include: { plan: true },
  })
}

/**
 * Record a verified payment and push the subscription forward.
 *
 * The new period is measured from whichever is later, the existing end or now:
 * paying early never loses the days already bought, and a lapsed shop is not
 * charged for the time it spent locked out.
 */
export async function recordPayment(params: {
  orgId: string
  amount: number
  method: BillingPaymentMethod
  cycle: BillingCycle
  reference?: string | null
  note?: string | null
  receivedAt?: Date
  recordedBy: string
  /** Set when the shop is also moving to a different tier with this payment. */
  planId?: string | null
}) {
  const now = new Date()
  const receivedAt = params.receivedAt ?? now

  return prisma.$transaction(async (tx) => {
    const sub = await tx.subscription.findUnique({
      where: { organizationId: params.orgId },
      select: { id: true, currentPeriodEnd: true, planId: true, agreedMonthlyPrice: true },
    })
    if (!sub) throw new Error('This organisation has no subscription')

    const periodStart = sub.currentPeriodEnd && sub.currentPeriodEnd > now ? sub.currentPeriodEnd : now
    const periodEnd = extendPeriod(sub.currentPeriodEnd, params.cycle, now)

    const payment = await tx.subscriptionPayment.create({
      data: {
        organizationId: params.orgId,
        amount: params.amount,
        method: params.method,
        cycle: params.cycle,
        monthsAdded: monthsFor(params.cycle),
        reference: params.reference ?? null,
        note: params.note ?? null,
        periodStart,
        periodEnd,
        receivedAt,
        recordedBy: params.recordedBy,
      },
    })

    const subscription = await tx.subscription.update({
      where: { id: sub.id },
      data: {
        status: 'ACTIVE',
        cycle: params.cycle,
        currentPeriodEnd: periodEnd,
        // Paying ends the trial. trialEndsAt is cleared so the deadline is
        // unambiguously currentPeriodEnd from here on.
        trialEndsAt: null,
        cancelledAt: null,
        ...(params.planId ? { planId: params.planId } : {}),
      },
      include: { plan: true },
    })

    return { payment, subscription }
  })
}

/**
 * Turn a shop's claim into a real payment.
 *
 * Purges the receipt image on success. The amount, reference and date are the
 * audit trail and stay forever; the screenshot is only needed until a human has
 * looked at it, and base64 images in Postgres are 33% larger than the file.
 */
export async function verifyPaymentClaim(claimId: string, reviewerId: string) {
  const claim = await prisma.paymentClaim.findUnique({ where: { id: claimId } })
  if (!claim) throw new Error('Claim not found')
  if (claim.status !== 'PENDING') throw new Error('This claim was already reviewed')

  const { payment, subscription } = await recordPayment({
    orgId: claim.organizationId,
    amount: Number(claim.amount),
    method: claim.method,
    cycle: claim.cycle,
    reference: claim.reference,
    note: claim.note,
    receivedAt: claim.paidOn,
    recordedBy: reviewerId,
  })

  await prisma.paymentClaim.update({
    where: { id: claimId },
    data: {
      status: 'VERIFIED',
      reviewedBy: reviewerId,
      reviewedAt: new Date(),
      paymentId: payment.id,
      receiptImage: null,
    },
  })

  return { payment, subscription }
}

export async function rejectPaymentClaim(claimId: string, reviewerId: string, reason: string) {
  return prisma.paymentClaim.update({
    where: { id: claimId },
    data: {
      status: 'REJECTED',
      reviewedBy: reviewerId,
      reviewedAt: new Date(),
      rejectReason: reason.slice(0, 500),
      // Keep the image on rejection: the shop will ask why, and we need to be
      // able to look at what they actually sent.
    },
  })
}

/**
 * Move an org to a different plan.
 *
 * Snapshots the new plan's list price unless an explicit price is given, which
 * is how friend accounts, referral discounts and grandfathering all work
 * through one field.
 */
export async function changePlan(params: {
  orgId: string
  planCode: string
  agreedMonthlyPrice?: number | null
  priceNote?: string | null
  setBy: string
}) {
  const plan = await prisma.plan.findUnique({ where: { code: params.planCode } })
  if (!plan) throw new Error(`Unknown plan ${params.planCode}`)

  return prisma.subscription.update({
    where: { organizationId: params.orgId },
    data: {
      planId: plan.id,
      agreedMonthlyPrice:
        params.agreedMonthlyPrice === undefined || params.agreedMonthlyPrice === null
          ? plan.monthlyPrice
          : params.agreedMonthlyPrice,
      ...(params.priceNote !== undefined ? { priceNote: params.priceNote } : {}),
      priceSetBy: params.setBy,
    },
    include: { plan: true },
  })
}

/** What a shop currently owes for a given cycle, including paid extra shops. */
export function amountDue(
  agreedMonthlyPrice: number,
  extraShops: number,
  extraShopPrice: number | null,
  cycle: BillingCycle
): number {
  const perMonth = agreedMonthlyPrice + extraShops * (extraShopPrice ?? 0)
  return priceFor(perMonth, cycle)
}

/** Feature list for a plan code, falling back to the compiled-in defaults. */
export function featuresForPlanCode(code: string): string[] {
  return PLAN_FEATURES[code] ?? PLAN_FEATURES.SOLO ?? []
}
