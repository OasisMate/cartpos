import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db/prisma'
import { resolveBillingState } from '@/lib/billing/subscription'

/**
 * Platform admin: every org's subscription in one list.
 *
 * This is the daily revenue view, so it reports the EFFECTIVE state (computed
 * against today's date) rather than the stored status, which can lag behind
 * until something touches the row.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'PLATFORM_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const filter = searchParams.get('filter') // 'expiring' | 'unpaid' | null

  try {
    const orgs = await prisma.organization.findMany({
      include: {
        subscription: { include: { plan: true } },
        _count: { select: { shops: true } },
        users: { select: { userId: true } },
      },
      orderBy: { createdAt: 'asc' },
    })

    // Head count has to span both membership tables. Organization.users holds
    // only ORG_ADMIN rows, so counting it alone reported "1 user" for a shop
    // with an owner and three staff, on the very page where seat caps matter.
    const seatRows = await prisma.userShop.findMany({
      where: { isActive: true },
      select: { userId: true, shop: { select: { orgId: true } } },
    })
    const peoplePerOrg = new Map<string, Set<string>>()
    for (const seat of seatRows) {
      const set = peoplePerOrg.get(seat.shop.orgId) ?? new Set<string>()
      set.add(seat.userId)
      peoplePerOrg.set(seat.shop.orgId, set)
    }
    for (const org of orgs) {
      const set = peoplePerOrg.get(org.id) ?? new Set<string>()
      org.users.forEach((u) => set.add(u.userId))
      peoplePerOrg.set(org.id, set)
    }

    const pendingClaims = await prisma.paymentClaim.groupBy({
      by: ['organizationId'],
      where: { status: 'PENDING' },
      _count: { _all: true },
    })
    const claimCounts = new Map(pendingClaims.map((c) => [c.organizationId, c._count._all]))

    let rows = orgs.map((org) => {
      const state = resolveBillingState(org)
      const sub = org.subscription
      return {
        orgId: org.id,
        name: org.name.trim(),
        city: org.city,
        isDemo: org.isDemo,
        freeAccess: org.billingExempt,
        freeAccessNote: org.billingExemptNote,
        orgStatus: org.status,
        referralSource: org.referralSource,
        shops: org._count.shops,
        users: peoplePerOrg.get(org.id)?.size ?? 0,
        pendingClaims: claimCounts.get(org.id) ?? 0,
        planCode: sub?.plan?.code ?? null,
        planName: sub?.plan?.name ?? null,
        // Effective, not stored: what the paywall would actually do today.
        status: state.status,
        canWrite: state.canWrite,
        daysLeft: state.daysLeft,
        deadline: state.deadline,
        inTrial: state.inTrial,
        agreedMonthlyPrice: sub ? Number(sub.agreedMonthlyPrice) : null,
        priceNote: sub?.priceNote ?? null,
        cycle: sub?.cycle ?? null,
        extraShops: sub?.extraShops ?? 0,
        // A free account is a deliberate decision, so make it obvious in the list.
        isComplimentary: sub ? Number(sub.agreedMonthlyPrice) === 0 : false,
      }
    })

    if (filter === 'expiring') {
      rows = rows.filter((r) => r.daysLeft !== null && r.daysLeft <= 7)
    } else if (filter === 'unpaid') {
      rows = rows.filter((r) => !r.canWrite || r.pendingClaims > 0)
    }

    // Money actually being collected, not money we hope to collect. A row only
    // counts once somebody has paid for a period that has not run out: an org
    // sitting on a trial, a grace window or a complimentary account is worth
    // zero. Counting effective-ACTIVE here reported Rs 23,996 of revenue while
    // the SubscriptionPayment table was empty.
    const paying = rows.filter(
      (r) =>
        !r.isDemo &&
        !r.freeAccess &&
        !r.isComplimentary &&
        !r.inTrial &&
        r.status === 'ACTIVE' &&
        r.daysLeft !== null &&
        r.daysLeft > 0
    )
    const revenue = paying.reduce((sum, r) => sum + (r.agreedMonthlyPrice ?? 0), 0)

    return NextResponse.json({
      rows,
      summary: {
        total: rows.length,
        paying: paying.length,
        trialing: rows.filter((r) => r.status === 'TRIALING').length,
        active: rows.filter((r) => r.status === 'ACTIVE').length,
        pastDue: rows.filter((r) => r.status === 'PAST_DUE').length,
        expired: rows.filter((r) => r.status === 'EXPIRED').length,
        complimentary: rows.filter((r) => r.isComplimentary).length,
        pendingClaims: rows.reduce((s, r) => s + r.pendingClaims, 0),
        monthlyRecurring: revenue,
      },
    })
  } catch (error) {
    console.error('Admin subscriptions error:', error)
    return NextResponse.json({ error: 'Failed to load subscriptions' }, { status: 500 })
  }
}
