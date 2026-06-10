/**
 * Reset the DEMO / TEST org back to its seeded baseline.
 *
 *   npx tsx scripts/reset-demo-org.ts
 *
 * HARD-GUARDED: operates ONLY on an Organization with isDemo=true. It refuses to touch
 * any other org, so it can never harm a real shop's data. It tears the demo org down
 * completely (transactional data, catalog, shops, demo users, the org) and then re-seeds
 * the baseline via seedDemoOrg().
 */
import { PrismaClient } from '@prisma/client'
import { seedDemoOrg, DEMO_USERS } from './seed-demo-org'

const prisma = new PrismaClient()

async function safeDeleteMany(fn: () => Promise<unknown>) {
  try {
    await fn()
  } catch (e: any) {
    console.warn('  (skipped a cleanup step:', e?.message || e, ')')
  }
}

async function resetDemoOrg() {
  const org = await prisma.organization.findFirst({ where: { isDemo: true } })
  if (!org) {
    console.log('No demo org found. Nothing to reset — running seed instead.')
    await seedDemoOrg()
    return
  }

  // SAFETY: never proceed unless this is unambiguously a demo org.
  if (!org.isDemo) {
    throw new Error('Refusing to reset: target org is not flagged isDemo.')
  }
  console.log(`Resetting demo org "${org.name}" (id=${org.id})...`)

  const shops = await prisma.shop.findMany({ where: { orgId: org.id }, select: { id: true } })
  const shopIds = shops.map((s) => s.id)
  const inShop = { shopId: { in: shopIds } }

  // Children first (FK-safe).
  await safeDeleteMany(() => prisma.payment.deleteMany({ where: inShop }))
  await safeDeleteMany(() => prisma.customerLedger.deleteMany({ where: inShop }))
  await safeDeleteMany(() => prisma.supplierLedger.deleteMany({ where: inShop }))
  await safeDeleteMany(() => prisma.stockLedger.deleteMany({ where: inShop }))
  await safeDeleteMany(() => prisma.invoiceLine.deleteMany({ where: { invoice: { shopId: { in: shopIds } } } }))
  await safeDeleteMany(() => prisma.invoice.deleteMany({ where: inShop }))
  await safeDeleteMany(() => prisma.purchaseLine.deleteMany({ where: { purchase: { shopId: { in: shopIds } } } }))
  await safeDeleteMany(() => prisma.purchase.deleteMany({ where: inShop }))
  await safeDeleteMany(() => prisma.expense.deleteMany({ where: inShop }))
  await safeDeleteMany(() => prisma.product.deleteMany({ where: inShop }))
  await safeDeleteMany(() => prisma.customer.deleteMany({ where: inShop }))
  await safeDeleteMany(() => prisma.supplier.deleteMany({ where: inShop }))
  await safeDeleteMany(() => prisma.shopSettings.deleteMany({ where: inShop }))
  await safeDeleteMany(() => prisma.userShop.deleteMany({ where: inShop }))

  // Audit + notifications referencing the org/shops (may FK to Organization).
  await safeDeleteMany(() => prisma.activityLog.deleteMany({ where: { orgId: org.id } }))
  await safeDeleteMany(() => prisma.notification.deleteMany({ where: { orgId: org.id } }))

  await safeDeleteMany(() => prisma.shop.deleteMany({ where: { orgId: org.id } }))
  await safeDeleteMany(() => prisma.organizationUser.deleteMany({ where: { orgId: org.id } }))

  // Demo users (by their known emails) + any notifications they own.
  const demoEmails = Object.values(DEMO_USERS)
  await safeDeleteMany(() =>
    prisma.notification.deleteMany({ where: { user: { email: { in: demoEmails } } } })
  )
  await safeDeleteMany(() => prisma.user.deleteMany({ where: { email: { in: demoEmails } } }))

  await prisma.organization.delete({ where: { id: org.id } })
  console.log('  Teardown complete. Re-seeding baseline...')

  await seedDemoOrg()
}

resetDemoOrg()
  .then(() => prisma.$disconnect())
  .then(() => process.exit(0))
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
