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
        _count: { select: { shops: true, users: true } },
      },
      orderBy: { createdAt: 'asc' },
    })

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
        orgStatus: org.status,
        referralSource: org.referralSource,
        shops: org._count.shops,
        users: org._count.users,
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
        neverExpires: sub ? sub.currentPeriodEnd === null && sub.status !== 'TRIALING' : false,
      }
    })

    if (filter === 'expiring') {
      rows = rows.filter((r) => r.daysLeft !== null && r.daysLeft <= 7)
    } else if (filter === 'unpaid') {
      rows = rows.filter((r) => !r.canWrite || r.pendingClaims > 0)
    }

    const revenue = rows
      .filter((r) => r.status === 'ACTIVE' && !r.isDemo)
      .reduce((sum, r) => sum + (r.agreedMonthlyPrice ?? 0), 0)

    return NextResponse.json({
      rows,
      summary: {
        total: rows.length,
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
