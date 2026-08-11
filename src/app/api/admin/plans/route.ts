import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db/prisma'

/**
 * Platform admin: edit plan prices, caps and features.
 *
 * Changing a price here affects NEW subscriptions only. Existing customers hold
 * their own snapshotted `agreedMonthlyPrice`, so a rise never silently reprices
 * anyone who already signed up. Moving an existing customer is a deliberate,
 * separate action on their subscription.
 */

async function requireAdmin() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'PLATFORM_ADMIN') return null
  return user
}

export async function GET() {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const plans = await prisma.plan.findMany({
    orderBy: { sortOrder: 'asc' },
    include: { _count: { select: { subscriptions: true } } },
  })

  return NextResponse.json({
    plans: plans.map((p) => ({
      ...p,
      monthlyPrice: Number(p.monthlyPrice),
      extraShopPrice: p.extraShopPrice === null ? null : Number(p.extraShopPrice),
    })),
  })
}

export async function PATCH(request: Request) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => null)
  const code = body?.code as string | undefined
  if (!code) return NextResponse.json({ error: 'Plan code is required' }, { status: 400 })

  const existing = await prisma.plan.findUnique({ where: { code } })
  if (!existing) return NextResponse.json({ error: 'Unknown plan' }, { status: 404 })

  const data: Record<string, unknown> = {}

  if (body.monthlyPrice !== undefined) {
    const price = Number(body.monthlyPrice)
    if (!Number.isFinite(price) || price < 0) {
      return NextResponse.json({ error: 'Enter a valid price' }, { status: 400 })
    }
    data.monthlyPrice = price
  }
  if (body.extraShopPrice !== undefined) {
    data.extraShopPrice =
      body.extraShopPrice === null ? null : Math.max(0, Number(body.extraShopPrice) || 0)
  }
  if (body.name !== undefined) data.name = String(body.name).slice(0, 60)
  if (body.tagline !== undefined) data.tagline = String(body.tagline).slice(0, 120)
  if (body.maxShops !== undefined) data.maxShops = body.maxShops === null ? null : Number(body.maxShops)
  if (body.maxUsers !== undefined) data.maxUsers = body.maxUsers === null ? null : Number(body.maxUsers)
  if (body.maxCashiers !== undefined) {
    data.maxCashiers = body.maxCashiers === null ? null : Number(body.maxCashiers)
  }
  if (body.allowOrgLevel !== undefined) data.allowOrgLevel = Boolean(body.allowOrgLevel)
  if (body.isActive !== undefined) data.isActive = Boolean(body.isActive)
  if (Array.isArray(body.features)) data.features = body.features.map(String)

  // Only one plan wears the "Most Popular" badge, or it means nothing.
  if (body.isPopular !== undefined) {
    data.isPopular = Boolean(body.isPopular)
    if (data.isPopular) {
      await prisma.plan.updateMany({ where: { code: { not: code } }, data: { isPopular: false } })
    }
  }

  const plan = await prisma.plan.update({ where: { code }, data: { ...data, updatedBy: user.id } })

  const priceChanged =
    body.monthlyPrice !== undefined && Number(existing.monthlyPrice) !== Number(plan.monthlyPrice)

  // Not written to ActivityLog: that table requires an orgId FK and a plan
  // belongs to no organization. Plan.updatedBy/updatedAt carry the attribution,
  // and the per-customer money decisions (subscription price, payments) are
  // fully logged against their org.
  if (priceChanged) {
    console.info(
      `[billing] plan ${code} price ${Number(existing.monthlyPrice)} -> ${Number(plan.monthlyPrice)} by ${user.email}`
    )
  }

  return NextResponse.json({
    plan: {
      ...plan,
      monthlyPrice: Number(plan.monthlyPrice),
      extraShopPrice: plan.extraShopPrice === null ? null : Number(plan.extraShopPrice),
    },
    // Say it out loud so nobody assumes a price change swept the customer base.
    note: priceChanged ? 'New price applies to new signups only. Existing customers keep their agreed price.' : undefined,
  })
}
