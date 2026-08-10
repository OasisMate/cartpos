/**
 * One-off: release the orgs that were stuck waiting for admin approval.
 *
 * Approval was dropped in favour of the 14-day trial plus paywall, so anyone
 * left on PENDING would otherwise sit on /waiting-approval forever with nobody
 * coming to approve them.
 *
 * Each org is set ACTIVE and its trial clock RESTARTED from now. They have
 * never been able to log in, so starting the count at signup would hand them a
 * trial that had already partly expired through no fault of theirs.
 *
 * Deliberately does not touch SUSPENDED or INACTIVE orgs: those are switched
 * off on purpose, and that is a separate decision from billing.
 *
 * Run: npx tsx scripts/activate-pending-orgs.ts --dry-run
 *      npx tsx scripts/activate-pending-orgs.ts
 */
import { PrismaClient } from '@prisma/client'
import { TRIAL_DAYS, trialEndFrom, TRIAL_PLAN_CODE } from '../src/lib/billing/trial'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

async function main() {
  if (DRY_RUN) console.log('DRY RUN - nothing will be written\n')

  const pending = await prisma.organization.findMany({
    where: { status: 'PENDING' },
    select: {
      id: true,
      name: true,
      createdAt: true,
      subscription: { select: { id: true, status: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  if (pending.length === 0) {
    console.log('No PENDING organisations. Nothing to do.')
    return
  }

  const plan = await prisma.plan.findUnique({
    where: { code: TRIAL_PLAN_CODE },
    select: { id: true, monthlyPrice: true },
  })
  if (!plan) {
    console.error(`Plan ${TRIAL_PLAN_CODE} is not seeded. Run scripts/seed-billing-plans.ts first.`)
    process.exit(1)
  }

  const now = new Date()
  const trialEndsAt = trialEndFrom(now)

  for (const org of pending) {
    const label = `${org.name.trim()} (signed up ${org.createdAt.toISOString().slice(0, 10)})`
    if (DRY_RUN) {
      console.log(`would activate: ${label} -> trial until ${trialEndsAt.toISOString().slice(0, 10)}`)
      continue
    }

    await prisma.$transaction(async (tx) => {
      await tx.organization.update({
        where: { id: org.id },
        data: {
          status: 'ACTIVE',
          approvedAt: now,
          approvedBy: 'system:approval-dropped',
          rejectionReason: null,
        },
      })

      await tx.subscription.upsert({
        where: { organizationId: org.id },
        create: {
          organizationId: org.id,
          planId: plan.id,
          status: 'TRIALING',
          cycle: 'MONTHLY',
          agreedMonthlyPrice: plan.monthlyPrice,
          trialEndsAt,
          currentPeriodEnd: null,
        },
        update: {
          planId: plan.id,
          status: 'TRIALING',
          // Restart from today: their trial begins when they can first log in.
          trialEndsAt,
          currentPeriodEnd: null,
        },
      })
    })

    console.log(`activated: ${label} -> ${TRIAL_DAYS}-day trial until ${trialEndsAt.toISOString().slice(0, 10)}`)
  }

  console.log(`\n${pending.length} organisation(s) ${DRY_RUN ? 'would be' : ''} activated.`)

  if (!DRY_RUN) {
    const left = await prisma.organization.count({ where: { status: 'PENDING' } })
    console.log(left === 0 ? 'PASS: no PENDING orgs remain' : `WARNING: ${left} still PENDING`)
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
