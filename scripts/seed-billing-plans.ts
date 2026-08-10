/**
 * Seed the three plans and grandfather every existing organization.
 *
 * Idempotent: safe to re-run. Upserts plans by `code`, and only creates a
 * Subscription for orgs that do not already have one.
 *
 * GRANDFATHERING IS THE POINT. Every org that exists when billing ships gets
 * Business at agreedMonthlyPrice 0 with currentPeriodEnd = null (never expires).
 * Rose Mart, Mughal Corp and anything else live must never be gated by this
 * work. Charging them, if ever, is a manual per-org decision later.
 *
 * Run: npx tsx scripts/seed-billing-plans.ts
 *      npx tsx scripts/seed-billing-plans.ts --dry-run
 */
import { PrismaClient } from '@prisma/client'
import { BASE_FEATURES, TEAM_FEATURES, BUSINESS_FEATURES } from '../src/lib/billing/features'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const PLANS = [
  {
    code: 'SOLO',
    name: 'Solo',
    tagline: 'Just me',
    monthlyPrice: 1999,
    maxShops: 1,
    maxUsers: 1,
    maxCashiers: 0,
    allowOrgLevel: false,
    extraShopPrice: null,
    features: BASE_FEATURES,
    isPopular: false,
    sortOrder: 1,
  },
  {
    code: 'TEAM',
    name: 'Team',
    tagline: 'Me + 2 cashiers',
    monthlyPrice: 3999,
    maxShops: 1,
    maxUsers: 3,
    maxCashiers: 2,
    allowOrgLevel: false,
    extraShopPrice: null,
    features: TEAM_FEATURES,
    isPopular: true, // centre position + "Most Popular" badge
    sortOrder: 2,
  },
  {
    code: 'BUSINESS',
    name: 'Business',
    tagline: 'Unlimited staff',
    monthlyPrice: 5999,
    maxShops: 2,
    maxUsers: null, // unlimited
    maxCashiers: null,
    allowOrgLevel: true,
    extraShopPrice: 1999,
    features: BUSINESS_FEATURES,
    isPopular: false,
    sortOrder: 3,
  },
]

async function main() {
  if (DRY_RUN) console.log('DRY RUN - nothing will be written\n')

  // ---- Plans -----------------------------------------------------
  for (const p of PLANS) {
    if (DRY_RUN) {
      console.log(`would upsert plan ${p.code} @ ${p.monthlyPrice} (${p.features.length} features)`)
      continue
    }
    await prisma.plan.upsert({
      where: { code: p.code },
      create: p,
      // Deliberately does NOT overwrite monthlyPrice on re-run: once live, the
      // price is edited in /admin/plans, and this script must not stomp it.
      update: {
        name: p.name,
        tagline: p.tagline,
        maxShops: p.maxShops,
        maxUsers: p.maxUsers,
        maxCashiers: p.maxCashiers,
        allowOrgLevel: p.allowOrgLevel,
        features: p.features,
        isPopular: p.isPopular,
        sortOrder: p.sortOrder,
      },
    })
    console.log(`plan ${p.code} ok`)
  }

  const business = DRY_RUN
    ? { id: 'DRY' }
    : await prisma.plan.findUniqueOrThrow({ where: { code: 'BUSINESS' } })

  // ---- Grandfather existing orgs ---------------------------------
  const orgs = await prisma.organization.findMany({
    select: { id: true, name: true, isDemo: true, subscription: { select: { id: true } } },
    orderBy: { createdAt: 'asc' },
  })

  let created = 0
  let skipped = 0

  for (const org of orgs) {
    if (org.subscription) {
      skipped++
      continue
    }
    const label = `${org.name}${org.isDemo ? ' [demo]' : ''}`
    if (DRY_RUN) {
      console.log(`would grandfather: ${label}`)
      created++
      continue
    }
    await prisma.subscription.create({
      data: {
        organizationId: org.id,
        planId: business.id,
        status: 'ACTIVE',
        cycle: 'MONTHLY',
        agreedMonthlyPrice: 0,
        currentPeriodEnd: null, // never expires
        priceNote: 'grandfathered at launch',
        priceSetBy: 'seed-billing-plans',
      },
    })
    console.log(`grandfathered: ${label}`)
    created++
  }

  console.log(`\nplans: ${PLANS.length} | orgs grandfathered: ${created} | already had one: ${skipped}`)

  // ---- Billing settings placeholder ------------------------------
  if (!DRY_RUN) {
    await prisma.billingSettings.upsert({
      where: { id: 'default' },
      create: { id: 'default', instructions: 'Bank details not set yet.' },
      update: {},
    })
    console.log('billing settings row ok')
  }

  // ---- Safety check ----------------------------------------------
  if (!DRY_RUN) {
    const gated = await prisma.subscription.count({
      where: { currentPeriodEnd: { not: null } },
    })
    console.log(
      gated === 0
        ? 'SAFE: no existing org has an expiry date'
        : `WARNING: ${gated} subscription(s) have an expiry date - check these are new signups, not grandfathered orgs`
    )
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
