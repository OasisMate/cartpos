/**
 * One-off: put Rose Mart on a fresh 14-day trial.
 *
 * It was grandfathered (ACTIVE with no deadline at all), which is the
 * never-expires state we have removed. A trial gives it a real deadline and the
 * same path as everyone else: pick a plan, pay, or suspend.
 *
 * Run: npx tsx scripts/reset-rose-mart-trial.ts [--confirm]
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const CONFIRM = process.argv.includes('--confirm')
const ORG = 'Rose Mart'
const TRIAL_DAYS = 14

async function main() {
  const org = await prisma.organization.findFirst({
    where: { name: { startsWith: ORG } },
    include: { subscription: { include: { plan: true } } },
  })
  if (!org) throw new Error(`${ORG} not found`)

  const sub = org.subscription
  console.log(`${org.name.trim()}  status=${org.status}  isDemo=${org.isDemo}  free=${org.billingExempt}`)
  console.log(`  sub: ${sub?.status ?? 'NONE'} plan=${sub?.plan.code ?? '-'} trialEndsAt=${sub?.trialEndsAt?.toISOString() ?? 'null'} currentPeriodEnd=${sub?.currentPeriodEnd?.toISOString() ?? 'null'}`)

  const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000)
  console.log(`\nWould set: TRIALING, trialEndsAt=${trialEndsAt.toISOString()}, currentPeriodEnd=null`)

  if (!CONFIRM) {
    console.log('\nDRY RUN. Re-run with --confirm to apply.')
    return
  }
  if (!sub) throw new Error('No subscription row to update')

  const updated = await prisma.subscription.update({
    where: { organizationId: org.id },
    data: { status: 'TRIALING', trialEndsAt, currentPeriodEnd: null },
  })
  console.log(`\nApplied. ${org.name.trim()} is TRIALING until ${updated.trialEndsAt?.toDateString()}`)
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1) }).finally(() => prisma.$disconnect())
