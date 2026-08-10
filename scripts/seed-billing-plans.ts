/**
 * Seed the three plans and give every existing organization a subscription.
 *
 * Two different outcomes, decided ONLY by the org's current status:
 *
 *   ACTIVE org      -> grandfathered. Business, agreedMonthlyPrice 0,
 *                      currentPeriodEnd null (never expires). These are the
 *                      shops already running on trust; they must never be gated
 *                      by this work. Charging them, if ever, is a manual choice.
 *
 *   anything else   -> the normal new flow. Business 14-day trial at the real
 *   (PENDING /         list price, so they convert like any new signup.
 *   SUSPENDED /        PENDING orgs have never actually been able to log in, so
 *   INACTIVE)          Phase 3 refreshes the clock when it activates them and
 *                      nobody loses trial days waiting on us.
 *
 * Idempotent and self-correcting: re-running fixes an org that was seeded into
 * the wrong bucket.
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

  // ---- Subscriptions for existing orgs ---------------------------
  const TRIAL_DAYS = 14
  const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000)
  const businessPrice = DRY_RUN ? 5999 : Number(business.monthlyPrice)

  const orgs = await prisma.organization.findMany({
    select: {
      id: true,
      name: true,
      isDemo: true,
      status: true,
      subscription: { select: { id: true, priceNote: true, status: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  let grandfathered = 0
  let trialed = 0
  let corrected = 0
  let untouched = 0

  for (const org of orgs) {
    const label = `${org.name.trim()}${org.isDemo ? ' [demo]' : ''} (${org.status})`
    const shouldGrandfather = org.status === 'ACTIVE'

    // What this org SHOULD have.
    const target = shouldGrandfather
      ? {
          status: 'ACTIVE' as const,
          agreedMonthlyPrice: 0,
          trialEndsAt: null,
          currentPeriodEnd: null, // never expires
          priceNote: 'grandfathered at launch',
        }
      : {
          status: 'TRIALING' as const,
          agreedMonthlyPrice: businessPrice,
          trialEndsAt,
          currentPeriodEnd: null, // TRIALING: the deadline is trialEndsAt
          priceNote: `14-day trial at launch (org was ${org.status})`,
        }

    const existing = org.subscription

    // Already correct? Leave it alone. Only auto-correct rows this script wrote,
    // so a price hand-set in /admin/subscriptions is never stomped.
    if (existing) {
      const isSeedWritten = existing.priceNote?.includes('at launch') ?? false
      const alreadyRight = existing.status === target.status
      if (alreadyRight || !isSeedWritten) {
        untouched++
        continue
      }
      if (DRY_RUN) {
        console.log(`would CORRECT ${label}: ${existing.status} -> ${target.status}`)
        corrected++
        continue
      }
      await prisma.subscription.update({
        where: { id: existing.id },
        data: { ...target, planId: business.id, priceSetBy: 'seed-billing-plans' },
      })
      console.log(`corrected: ${label} -> ${target.status}`)
      corrected++
      continue
    }

    if (DRY_RUN) {
      console.log(`would ${shouldGrandfather ? 'grandfather' : 'trial'}: ${label}`)
      shouldGrandfather ? grandfathered++ : trialed++
      continue
    }

    await prisma.subscription.create({
      data: {
        organizationId: org.id,
        planId: business.id,
        cycle: 'MONTHLY',
        priceSetBy: 'seed-billing-plans',
        ...target,
      },
    })
    console.log(`${shouldGrandfather ? 'grandfathered' : 'trial started'}: ${label}`)
    shouldGrandfather ? grandfathered++ : trialed++
  }

  console.log(
    `\nplans: ${PLANS.length} | grandfathered: ${grandfathered} | trials: ${trialed} | corrected: ${corrected} | untouched: ${untouched}`
  )

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
  // The one thing that must never be true: an org that is live and running
  // today having a deadline attached to it.
  if (!DRY_RUN) {
    const atRisk = await prisma.subscription.findMany({
      where: {
        organization: { status: 'ACTIVE', isDemo: false },
        OR: [{ currentPeriodEnd: { not: null } }, { trialEndsAt: { not: null } }],
      },
      select: { organization: { select: { name: true } }, status: true },
    })
    console.log(
      atRisk.length === 0
        ? 'SAFE: no ACTIVE org has an expiry or trial deadline'
        : `WARNING: ${atRisk.map((a) => a.organization.name).join(', ')} are ACTIVE but have a deadline`
    )
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
