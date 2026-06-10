/**
 * Temporarily unlock / re-lock the demo org's destructive-action guard, so YOU can QA
 * destructive flows (void, delete) on the fixture without spinning up a separate org.
 *
 *   npx tsx scripts/toggle-demo-lock.ts off   # disable lockdown (isDemo=false) — destructive actions work
 *   npx tsx scripts/toggle-demo-lock.ts on    # re-enable lockdown (isDemo=true) — demo-safe again
 *
 * NOTE: while OFF, anyone in the org can delete/void. Re-lock ('on') when done, and run
 * scripts/reset-demo-org.ts if you want the baseline data back. Targets ONLY the org named
 * 'CartPOS Demo' (or whichever org currently has isDemo=true).
 */
import { PrismaClient } from '@prisma/client'
import { DEMO_ORG_NAME } from './seed-demo-org'

const prisma = new PrismaClient()

async function main() {
  const arg = (process.argv[2] || '').toLowerCase()
  if (arg !== 'on' && arg !== 'off') {
    console.error("Usage: npx tsx scripts/toggle-demo-lock.ts <on|off>")
    process.exit(1)
  }
  const target = arg === 'on'

  // Find the demo org by current flag or by its known name.
  const org =
    (await prisma.organization.findFirst({ where: { isDemo: true } })) ||
    (await prisma.organization.findFirst({ where: { name: DEMO_ORG_NAME } }))

  if (!org) {
    console.error(`No demo org found (looked for isDemo=true or name "${DEMO_ORG_NAME}").`)
    process.exit(1)
  }

  await prisma.organization.update({ where: { id: org.id }, data: { isDemo: target } })
  console.log(`Demo lockdown ${target ? 'ENABLED (demo-safe)' : 'DISABLED (destructive actions allowed)'} for "${org.name}" (id=${org.id}).`)
  if (!target) console.log('Remember to run this with "on" when done QA-ing destructive flows.')
  console.log('Tip: users must re-login (or wait for session refresh) for the change to take effect, since isDemoOrg is read per request from getCurrentUser.')
}

main()
  .then(() => prisma.$disconnect())
  .then(() => process.exit(0))
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
