import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db/prisma'
import { verifyPaymentClaim, rejectPaymentClaim } from '@/lib/billing/service'
import { logActivity, ActivityActions, EntityTypes } from '@/lib/audit/activityLog'

/**
 * Platform admin: the payment verification queue.
 *
 * Verifying is one click and does everything: creates the payment, pushes the
 * period forward, sets the subscription ACTIVE and purges the receipt image.
 */

async function requireAdmin() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'PLATFORM_ADMIN') return null
  return user
}

export async function GET(request: Request) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') || 'PENDING'
  const withImage = searchParams.get('claimId')

  // The image is only fetched for the one claim being looked at, never for the
  // list: a few MB of base64 per row would make the queue unusable.
  if (withImage) {
    const claim = await prisma.paymentClaim.findUnique({
      where: { id: withImage },
      select: { id: true, receiptImage: true },
    })
    return NextResponse.json({ claim })
  }

  const claims = await prisma.paymentClaim.findMany({
    where: status === 'ALL' ? {} : { status: status as any },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true,
      organizationId: true,
      amount: true,
      method: true,
      cycle: true,
      reference: true,
      note: true,
      paidOn: true,
      status: true,
      rejectReason: true,
      reviewedAt: true,
      createdAt: true,
      receiptImage: false,
      organization: {
        select: {
          name: true,
          city: true,
          subscription: {
            select: {
              agreedMonthlyPrice: true,
              currentPeriodEnd: true,
              plan: { select: { code: true, name: true } },
            },
          },
        },
      },
    },
  })

  // Cheap boolean so the UI can show a "has receipt" marker without the payload.
  const ids = claims.map((c) => c.id)
  const withImages = await prisma.paymentClaim.findMany({
    where: { id: { in: ids }, receiptImage: { not: null } },
    select: { id: true },
  })
  const hasImage = new Set(withImages.map((c) => c.id))

  return NextResponse.json({
    claims: claims.map((c) => ({
      ...c,
      amount: Number(c.amount),
      hasReceipt: hasImage.has(c.id),
      agreedMonthlyPrice: c.organization.subscription
        ? Number(c.organization.subscription.agreedMonthlyPrice)
        : null,
    })),
  })
}

export async function POST(request: Request) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => null)
  const claimId = body?.claimId as string | undefined
  const action = body?.action as string | undefined
  if (!claimId || !action) {
    return NextResponse.json({ error: 'claimId and action are required' }, { status: 400 })
  }

  try {
    if (action === 'verify') {
      const { payment, subscription } = await verifyPaymentClaim(claimId, user.id)
      await logActivity({
        userId: user.id,
        orgId: payment.organizationId,
        action: ActivityActions.VERIFY_PAYMENT_CLAIM,
        entityType: EntityTypes.ORGANIZATION,
        entityId: payment.organizationId,
        details: {
          claimId,
          amount: Number(payment.amount),
          newPeriodEnd: payment.periodEnd,
        },
      })
      return NextResponse.json({
        payment: { ...payment, amount: Number(payment.amount) },
        subscription,
      })
    }

    if (action === 'reject') {
      const reason = String(body?.reason || '').trim()
      if (!reason) {
        // A rejection with no reason guarantees a confused phone call.
        return NextResponse.json({ error: 'Give a reason so the shop knows what to fix' }, { status: 400 })
      }
      const claim = await rejectPaymentClaim(claimId, user.id, reason)
      await logActivity({
        userId: user.id,
        orgId: claim.organizationId,
        action: ActivityActions.REJECT_PAYMENT_CLAIM,
        entityType: EntityTypes.ORGANIZATION,
        entityId: claim.organizationId,
        details: { claimId, reason },
      })
      return NextResponse.json({ claim: { ...claim, amount: Number(claim.amount), receiptImage: undefined } })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error: any) {
    console.error('Payment claim review error:', error)
    return NextResponse.json({ error: error.message || 'Failed to review claim' }, { status: 500 })
  }
}
