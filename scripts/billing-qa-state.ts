/**
 * Put the QA billing org into any subscription state instantly.
 *
 * Without this, testing the expiry path means waiting 14 days. Refuses to touch
 * any org except the QA one, so it can never be pointed at a real customer.
 *
 * Run: npx tsx scripts/qa-billing-state.ts <state>
 *
 *   trial          14 days left, everything unlocked
 *   trial-ending   2 days left, warning banner
 *   grace          trial ended yesterday, still writable (3-day grace)
 *   expired        trial ended 10 days ago, READ-ONLY
 *   paid           ACTIVE, 30 days paid
 *   lapsed         paid but 10 days overdue, READ-ONLY
 *   grandfathered  free, never expires (what Rose Mart looks like)
 *   solo           move to Solo plan (1 user, 1 shop) keeping the busiest shop
 *   team           move to Team plan (3 users, 2 cashiers)
 *   business       move back to Business and restore paused shops/seats
 *   status         just print the current state
 */
import { PrismaClient } from '@prisma/client'
import { QA_ORG_NAME } from './billing-qa-constants'
import { resolveBillingState } from '../src/lib/billing/subscription'
import { applyDowngrade, previewDowngrade } from '../src/lib/billing/downgrade'

const prisma = new PrismaClient()
const DAY = 24 * 60 * 60 * 1000
const state = (process.argv[2] || 'status').toLowerCase()

const at = (days: number) => new Date(Date.now() + days * DAY)

async function main() {
  const org = await prisma.organization.findFirst({
    where: { name: QA_ORG_NAME },
    include: { subscription: { include: { plan: true } }, shops: true },
  })

  if (!org) {
    console.error(`${QA_ORG_NAME} not found. Run scripts/seed-qa-billing-org.ts first.`)
    process.exit(1)
  }
  // Belt and braces: this script must never be able to touch a real customer.
  if (org.name !== QA_ORG_NAME || org.isDemo) {
    console.error('Refusing to modify a non-QA organisation.')
    process.exit(1)
  }

  const subId = org.subscription?.id
  if (!subId) {
    console.error('QA org has no subscription.')
    process.exit(1)
  }

  async function setPlan(code: string) {
    const plan = await prisma.plan.findUniqueOrThrow({ where: { code } })
    return plan
  }

  switch (state) {
    case 'trial':
      await prisma.subscription.update({
        where: { id: subId },
        data: { status: 'TRIALING', trialEndsAt: at(14), currentPeriodEnd: null },
      })
      break

    case 'trial-ending':
      await prisma.subscription.update({
        where: { id: subId },
        data: { status: 'TRIALING', trialEndsAt: at(2), currentPeriodEnd: null },
      })
      break

    case 'grace':
      await prisma.subscription.update({
        where: { id: subId },
        data: { status: 'TRIALING', trialEndsAt: at(-1), currentPeriodEnd: null },
      })
      break

    case 'expired':
      await prisma.subscription.update({
        where: { id: subId },
        data: { status: 'TRIALING', trialEndsAt: at(-10), currentPeriodEnd: null },
      })
      break

    case 'paid':
      await prisma.subscription.update({
        where: { id: subId },
        data: { status: 'ACTIVE', trialEndsAt: null, currentPeriodEnd: at(30) },
      })
      break

    case 'lapsed':
      await prisma.subscription.update({
        where: { id: subId },
        data: { status: 'ACTIVE', trialEndsAt: null, currentPeriodEnd: at(-10) },
      })
      break

    case 'grandfathered':
      await prisma.subscription.update({
        where: { id: subId },
        data: { status: 'ACTIVE', trialEndsAt: null, currentPeriodEnd: null, agreedMonthlyPrice: 0, priceNote: 'QA: grandfathered' },
      })
      break

    case 'solo':
    case 'team': {
      const code = state.toUpperCase()
      const impact = await previewDowngrade(org.id, code)
      const keep = impact.activeShops.slice(0, impact.shopAllowance ?? 1).map((s) => s.id)
      const result = await applyDowngrade({ orgId: org.id, planCode: code, keepShopIds: keep, setBy: 'qa-script' })
      console.log(`moved to ${code}: paused ${result.pausedShops} shop(s), ${result.pausedSeats} seat(s)`)
      break
    }

    case 'business': {
      // Same single-transaction path the UI uses, so QA exercises real code.
      const impact = await previewDowngrade(org.id, 'BUSINESS')
      const keep = impact.activeShops.map((s) => s.id)
      const result = await applyDowngrade({ orgId: org.id, planCode: 'BUSINESS', keepShopIds: keep, setBy: 'qa-script' })
      console.log(
        `moved to BUSINESS: restored ${result.restoredShops} shop(s), ${result.restoredSeats} seat row(s)`
      )
      break
    }

    case 'status':
      break

    default:
      console.error(`Unknown state "${state}". See the header of this file for the list.`)
      process.exit(1)
  }

  // Report the effective state, which is what actually governs access.
  process.env.BILLING_ENFORCED = 'true'
  const fresh = await prisma.organization.findUniqueOrThrow({
    where: { id: org.id },
    include: { subscription: { include: { plan: true } } },
  })
  const s = resolveBillingState(fresh)
  const shops = await prisma.shop.findMany({
    where: { orgId: org.id },
    select: { name: true, isActive: true, pausedReason: true },
    orderBy: { name: 'asc' },
  })
  const seats = await prisma.userShop.findMany({
    where: { shop: { orgId: org.id } },
    select: { isActive: true, shopRole: true, user: { select: { name: true } } },
  })

  console.log(`\n${QA_ORG_NAME}`)
  console.log(`  plan       ${s.planName} (${s.planCode})`)
  console.log(`  status     ${s.status}`)
  console.log(`  can write  ${s.canWrite ? 'YES' : 'NO (read-only)'}`)
  console.log(`  days left  ${s.daysLeft === null ? 'never expires' : s.daysLeft}`)
  console.log(`  org level  ${s.allowOrgLevel}`)
  console.log(`  caps       ${s.maxUsers ?? 'unlimited'} users, ${s.maxCashiers ?? 'unlimited'} cashiers, ${s.maxShops ?? 'unlimited'} shops`)
  console.log(`  shops      ${shops.map((x) => `${x.name}${x.isActive ? '' : ` [paused: ${x.pausedReason}]`}`).join(', ')}`)
  console.log(`  seats      ${seats.map((x) => `${x.user.name}${x.isActive ? '' : ' [paused]'}`).join(', ')}`)
  console.log(
    `\nreminder: BILLING_ENFORCED must be "true" in .env for the dev server to actually enforce this.`
  )
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
