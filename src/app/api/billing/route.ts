import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getBillingSettings, getSubscriptionForOrg, listPlans, amountDue } from '@/lib/billing/service'
import { BILLING_CYCLES, CYCLE_ORDER, priceFor, savingsFor } from '@/lib/billing/cycles'
import { prisma } from '@/lib/db/prisma'
import type { BillingCycle } from '@prisma/client'

/**
 * Everything the /billing page needs, in one call.
 *
 * NEVER gated by plan or by expiry. A Solo owner has no /org surface and an
 * expired org is read-only, so if this route were behind either check they
 * could never see what they owe or pay it.
 */
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orgId = user.currentOrgId
  if (!orgId) return NextResponse.json({ error: 'No organization selected' }, { status: 400 })

  const isOrgAdmin =
    user.organizations?.some((o) => o.orgId === orgId && o.orgRole === 'ORG_ADMIN') ||
    user.role === 'PLATFORM_ADMIN'
  if (!isOrgAdmin) {
    return NextResponse.json({ error: 'Only the owner can view billing' }, { status: 403 })
  }

  try {
    const [subscription, plans, settings, payments, claims, shopCount] = await Promise.all([
      getSubscriptionForOrg(orgId),
      listPlans(),
      getBillingSettings(),
      prisma.subscriptionPayment.findMany({
        where: { organizationId: orgId },
        orderBy: { receivedAt: 'desc' },
        take: 24,
      }),
      prisma.paymentClaim.findMany({
        where: { organizationId: orgId },
        orderBy: { createdAt: 'desc' },
        take: 12,
        // The image can be a couple of MB; the list never needs it.
        select: {
          id: true, amount: true, method: true, reference: true, paidOn: true,
          cycle: true, status: true, rejectReason: true, createdAt: true,
        },
      }),
      prisma.shop.count({ where: { orgId, isActive: true } }),
    ])

    const monthly = subscription ? Number(subscription.agreedMonthlyPrice) : 0
    const extraShopPrice = subscription?.plan?.extraShopPrice
      ? Number(subscription.plan.extraShopPrice)
      : null

    // Price every cycle so the picker can show the saving rather than make the
    // shopkeeper work it out.
    const cycleOptions = CYCLE_ORDER.map((cycle: BillingCycle) => ({
      cycle,
      label: BILLING_CYCLES[cycle].label,
      badge: BILLING_CYCLES[cycle].badge,
      months: BILLING_CYCLES[cycle].months,
      total: amountDue(monthly, subscription?.extraShops ?? 0, extraShopPrice, cycle),
      savings: savingsFor(monthly + (subscription?.extraShops ?? 0) * (extraShopPrice ?? 0), cycle),
    }))

    return NextResponse.json({
      billing: user.billing,
      subscription,
      plans: plans.map((p) => ({
        ...p,
        monthlyPrice: Number(p.monthlyPrice),
        extraShopPrice: p.extraShopPrice === null ? null : Number(p.extraShopPrice),
        // What each cycle would cost on THIS plan, for the pricing table.
        cyclePrices: CYCLE_ORDER.map((c) => ({ cycle: c, total: priceFor(Number(p.monthlyPrice), c) })),
      })),
      settings,
      payments: payments.map((p) => ({ ...p, amount: Number(p.amount) })),
      claims: claims.map((c) => ({ ...c, amount: Number(c.amount) })),
      cycleOptions,
      shopCount,
    })
  } catch (error) {
    console.error('Billing GET error:', error)
    return NextResponse.json({ error: 'Failed to load billing' }, { status: 500 })
  }
}
