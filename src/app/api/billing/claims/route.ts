import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getCurrentUser } from '@/lib/auth'
import { logActivity, ActivityActions, EntityTypes } from '@/lib/audit/activityLog'
import { notifyPlatformAdmins } from '@/lib/domain/notifications'
import type { BillingCycle, BillingPaymentMethod } from '@prisma/client'

/**
 * "I have paid" - the shop tells us about a transfer they have already made.
 *
 * This exists so payments arrive as a structured, reviewable queue instead of
 * being reconciled by scrolling WhatsApp. The screenshot is optional and most
 * shopkeepers will still send it on WhatsApp; what we need in the system is the
 * amount, method, date and reference.
 *
 * Never gated: an expired org must always be able to tell us they have paid.
 */

const METHODS: BillingPaymentMethod[] = ['RAAST', 'BANK_TRANSFER', 'JAZZCASH', 'EASYPAISA', 'CASH', 'OTHER']
const CYCLES: BillingCycle[] = ['MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY']

/** Same ceiling as the shop logo upload. A phone screenshot is well under this. */
const MAX_RECEIPT_BYTES = 2 * 1024 * 1024
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orgId = user.currentOrgId
  if (!orgId) return NextResponse.json({ error: 'No organization selected' }, { status: 400 })

  const isOrgAdmin =
    user.organizations?.some((o) => o.orgId === orgId && o.orgRole === 'ORG_ADMIN') ||
    user.role === 'PLATFORM_ADMIN'
  if (!isOrgAdmin) {
    return NextResponse.json({ error: 'Only the owner can submit a payment' }, { status: 403 })
  }

  try {
    const form = await request.formData()

    const amount = Number(form.get('amount'))
    const method = String(form.get('method') || '') as BillingPaymentMethod
    const cycle = String(form.get('cycle') || 'MONTHLY') as BillingCycle
    const reference = (form.get('reference') as string | null)?.trim() || null
    const note = (form.get('note') as string | null)?.trim() || null
    const paidOnRaw = form.get('paidOn') as string | null

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Enter the amount you paid' }, { status: 400 })
    }
    if (!METHODS.includes(method)) {
      return NextResponse.json({ error: 'Choose how you paid' }, { status: 400 })
    }
    if (!CYCLES.includes(cycle)) {
      return NextResponse.json({ error: 'Choose a billing period' }, { status: 400 })
    }

    const paidOn = paidOnRaw ? new Date(paidOnRaw) : new Date()
    if (Number.isNaN(paidOn.getTime())) {
      return NextResponse.json({ error: 'Enter a valid payment date' }, { status: 400 })
    }
    // A payment cannot have happened tomorrow. Allow a day of slack for time zones.
    if (paidOn.getTime() > Date.now() + 24 * 60 * 60 * 1000) {
      return NextResponse.json({ error: 'The payment date cannot be in the future' }, { status: 400 })
    }

    // Optional receipt image, stored as a base64 data URL exactly like the shop
    // logo (api/shop/logo). No storage bucket needed, and it is purged the
    // moment an admin verifies the claim.
    let receiptImage: string | null = null
    const file = form.get('receipt') as File | null
    if (file && file.size > 0) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        return NextResponse.json(
          { error: 'Receipt must be a PNG, JPG or WebP image' },
          { status: 400 }
        )
      }
      if (file.size > MAX_RECEIPT_BYTES) {
        return NextResponse.json({ error: 'Receipt image must be under 2MB' }, { status: 400 })
      }
      const buffer = Buffer.from(await file.arrayBuffer())
      receiptImage = `data:${file.type};base64,${buffer.toString('base64')}`
    }

    // One open claim at a time, so a double tap does not create a queue of
    // duplicates for the admin to sort out.
    const existing = await prisma.paymentClaim.findFirst({
      where: { organizationId: orgId, status: 'PENDING' },
      select: { id: true },
    })
    if (existing) {
      return NextResponse.json(
        { error: 'You already have a payment waiting to be checked. We will confirm it shortly.' },
        { status: 409 }
      )
    }

    const claim = await prisma.paymentClaim.create({
      data: {
        organizationId: orgId,
        amount,
        method,
        cycle,
        reference,
        note,
        paidOn,
        receiptImage,
        submittedBy: user.id,
      },
      select: { id: true, amount: true, status: true, createdAt: true },
    })

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { name: true },
    })

    await notifyPlatformAdmins({
      type: 'ORG_ACCESS_REQUEST',
      title: 'Payment to verify',
      body: `${org?.name ?? 'A shop'} says they paid Rs ${amount.toLocaleString('en-PK')} by ${method.replace('_', ' ').toLowerCase()}.`,
      href: '/admin/payment-claims',
    })

    await logActivity({
      userId: user.id,
      orgId,
      action: ActivityActions.SUBMIT_PAYMENT_CLAIM,
      entityType: EntityTypes.ORGANIZATION,
      entityId: orgId,
      details: { amount, method, cycle, reference, hasReceipt: Boolean(receiptImage) },
    })

    return NextResponse.json({ claim: { ...claim, amount: Number(claim.amount) } })
  } catch (error) {
    console.error('Payment claim error:', error)
    return NextResponse.json({ error: 'Could not submit your payment' }, { status: 500 })
  }
}
