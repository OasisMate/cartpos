/**
 * Bring stored subscription statuses in line with today's date.
 *
 * Safe to run any time, or never. Access is decided by resolveBillingState,
 * which always recomputes against the current date, so a shop is never wrongly
 * locked out because this has not run. The stored status only drives listing
 * and filtering in the admin view.
 *
 * Run: npx tsx scripts/billing-sweep.ts
 *      npx tsx scripts/billing-sweep.ts --dry-run
 */
import { PrismaClient } from '@prisma/client'
import { sweepSubscriptions } from '../src/lib/billing/lifecycle'
import { resolveBillingState } from '../src/lib/billing/subscription'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

async function main() {
  // Show the effective picture first, which is what actually governs access.
  process.env.BILLING_ENFORCED = 'true'
  const orgs = await prisma.organization.findMany({
    include: { subscription: { include: { plan: true } } },
    orderBy: { createdAt: 'asc' },
  })

  console.log('ORG                        | stored    | effective | canSell')
  for (const o of orgs) {
    const s = resolveBillingState(o)
    console.log(
      `${o.name.trim().padEnd(26)} | ${(o.subscription?.status ?? 'NONE').padEnd(9)} | ${s.status.padEnd(9)} | ${s.canWrite ? 'yes' : 'NO'}`
    )
  }

  if (DRY_RUN) {
    console.log('\nDRY RUN - no statuses written')
    return
  }

  const result = await sweepSubscriptions()
  console.log(
    `\nchecked ${result.checked} | -> PAST_DUE ${result.toPastDue} | -> EXPIRED ${result.toExpired}`
  )
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
