import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db/prisma'
import { changePlan, recordPayment } from '@/lib/billing/service'
import { logActivity, ActivityActions, EntityTypes } from '@/lib/audit/activityLog'
import type { BillingCycle, BillingPaymentMethod } from '@prisma/client'

const METHODS: BillingPaymentMethod[] = ['BANK_TRANSFER', 'JAZZCASH', 'EASYPAISA', 'CASH', 'OTHER']
const CYCLES: BillingCycle[] = ['MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY']

async function requireAdmin() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'PLATFORM_ADMIN') return null
  return user
}

/** One org's full billing history, for the detail drawer. */
export async function GET(_req: Request, { params }: { params: { orgId: string } }) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const [subscription, payments, claims] = await Promise.all([
    prisma.subscription.findUnique({
      where: { organizationId: params.orgId },
      include: { plan: true, organization: { select: { name: true, referralSource: true } } },
    }),
    prisma.subscriptionPayment.findMany({
      where: { organizationId: params.orgId },
      orderBy: { receivedAt: 'desc' },
      take: 50,
    }),
    prisma.paymentClaim.findMany({
      where: { organizationId: params.orgId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true, amount: true, method: true, status: true, paidOn: true,
        reference: true, rejectReason: true, createdAt: true,
      },
    }),
  ])

  return NextResponse.json({
    subscription,
    payments: payments.map((p) => ({ ...p, amount: Number(p.amount) })),
    claims: claims.map((c) => ({ ...c, amount: Number(c.amount) })),
  })
}

/**
 * Change an org's plan, agreed price, or record a payment against it.
 *
 * `agreedMonthlyPrice` is the single lever behind friend accounts (0), referral
 * discounts, and keeping a customer on an old price after a rise. Always paired
 * with a note, because in two years nobody will remember why this shop is free.
 */
export async function PATCH(request: Request, { params }: { params: { orgId: string } }) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  try {
    // ---- Record a payment -------------------------------------------
    if (body.action === 'recordPayment') {
      const amount = Number(body.amount)
      const method = body.method as BillingPaymentMethod
      const cycle = body.cycle as BillingCycle

      if (!Number.isFinite(amount) || amount < 0) {
        return NextResponse.json({ error: 'Enter a valid amount' }, { status: 400 })
      }
      if (!METHODS.includes(method)) {
        return NextResponse.json({ error: 'Choose a payment method' }, { status: 400 })
      }
      if (!CYCLES.includes(cycle)) {
        return NextResponse.json({ error: 'Choose a billing period' }, { status: 400 })
      }

      const { payment, subscription } = await recordPayment({
        orgId: params.orgId,
        amount,
        method,
        cycle,
        reference: body.reference ?? null,
        note: body.note ?? null,
        receivedAt: body.receivedAt ? new Date(body.receivedAt) : undefined,
        recordedBy: user.id,
      })

      await logActivity({
        userId: user.id,
        orgId: params.orgId,
        action: ActivityActions.RECORD_PAYMENT,
        entityType: EntityTypes.ORGANIZATION,
        entityId: params.orgId,
        details: { amount, method, cycle, periodEnd: payment.periodEnd },
      })

      return NextResponse.json({
        payment: { ...payment, amount: Number(payment.amount) },
        subscription,
      })
    }

    // ---- Change plan and/or agreed price -----------------------------
    if (body.action === 'changePlan') {
      const before = await prisma.subscription.findUnique({
        where: { organizationId: params.orgId },
        select: { agreedMonthlyPrice: true, plan: { select: { code: true } } },
      })

      const subscription = await changePlan({
        orgId: params.orgId,
        planCode: String(body.planCode || ''),
        agreedMonthlyPrice:
          body.agreedMonthlyPrice === undefined || body.agreedMonthlyPrice === null
            ? null
            : Number(body.agreedMonthlyPrice),
        priceNote: typeof body.priceNote === 'string' ? body.priceNote.slice(0, 300) : undefined,
        setBy: user.id,
      })

      await logActivity({
        userId: user.id,
        orgId: params.orgId,
        action: ActivityActions.CHANGE_PLAN,
        entityType: EntityTypes.ORGANIZATION,
        entityId: params.orgId,
        details: {
          from: { plan: before?.plan?.code, price: before ? Number(before.agreedMonthlyPrice) : null },
          to: { plan: subscription.plan.code, price: Number(subscription.agreedMonthlyPrice) },
          note: body.priceNote ?? null,
        },
      })

      return NextResponse.json({ subscription })
    }

    // ---- Extend or clear the expiry by hand ---------------------------
    // The escape hatch: "give them another week while they sort the transfer",
    // or put a grandfathered org back to never-expires.
    if (body.action === 'setDeadline') {
      const neverExpires = body.neverExpires === true
      const deadline = body.deadline ? new Date(body.deadline) : null
      if (!neverExpires && (!deadline || Number.isNaN(deadline.getTime()))) {
        return NextResponse.json({ error: 'Enter a valid date' }, { status: 400 })
      }

      const subscription = await prisma.subscription.update({
        where: { organizationId: params.orgId },
        data: neverExpires
          ? { currentPeriodEnd: null, trialEndsAt: null, status: 'ACTIVE' }
          : { currentPeriodEnd: deadline, trialEndsAt: null, status: 'ACTIVE' },
        include: { plan: true },
      })

      await logActivity({
        userId: user.id,
        orgId: params.orgId,
        action: ActivityActions.UPDATE_SUBSCRIPTION_PRICE,
        entityType: EntityTypes.ORGANIZATION,
        entityId: params.orgId,
        details: { setDeadline: neverExpires ? 'never' : deadline?.toISOString() },
      })

      return NextResponse.json({ subscription })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error: any) {
    console.error('Admin subscription PATCH error:', error)
    return NextResponse.json({ error: error.message || 'Failed to update' }, { status: 500 })
  }
}
