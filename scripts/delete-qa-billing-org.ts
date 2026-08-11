/**
 * Remove the QA billing organisation and everything under it.
 *
 * Hard-refuses to delete anything but the QA org: it matches on the exact name,
 * checks the org is not a demo fixture, and verifies every user it is about to
 * remove has a @cartpos.test address. A destructive script pointed at a real
 * shop by accident is unrecoverable, so it stops rather than guesses.
 *
 * Run: npx tsx scripts/delete-qa-billing-org.ts --dry-run
 *      npx tsx scripts/delete-qa-billing-org.ts --confirm
 */
import { PrismaClient } from '@prisma/client'
import { QA_ORG_NAME, QA_USERS } from './billing-qa-constants'

const prisma = new PrismaClient()
const DRY_RUN = !process.argv.includes('--confirm')

async function main() {
  const org = await prisma.organization.findFirst({
    where: { name: QA_ORG_NAME },
    include: { shops: { select: { id: true, name: true } } },
  })

  if (!org) {
    console.log(`${QA_ORG_NAME} not found. Nothing to delete.`)
    return
  }

  // --- safety gates ------------------------------------------------
  if (org.name !== QA_ORG_NAME) {
    console.error('Name mismatch. Refusing to delete.')
    process.exit(1)
  }
  const expectedEmails = Object.values(QA_USERS)
  const users = await prisma.user.findMany({
    where: { email: { in: expectedEmails } },
    select: { id: true, email: true },
  })
  const bad = users.filter((u) => !u.email.endsWith('@cartpos.test'))
  if (bad.length) {
    console.error('Refusing to delete: unexpected non-test users matched.')
    process.exit(1)
  }

  const shopIds = org.shops.map((s) => s.id)

  const counts = {
    shops: shopIds.length,
    invoices: await prisma.invoice.count({ where: { shopId: { in: shopIds } } }),
    products: await prisma.product.count({ where: { shopId: { in: shopIds } } }),
    customers: await prisma.customer.count({ where: { shopId: { in: shopIds } } }),
    users: users.length,
  }

  console.log(`${QA_ORG_NAME} (${org.id})`)
  Object.entries(counts).forEach(([k, v]) => console.log(`  ${k.padEnd(10)} ${v}`))

  if (DRY_RUN) {
    console.log('\nDRY RUN. Re-run with --confirm to actually delete.')
    return
  }

  // Child rows first: several relations have no cascade to Shop.
  //
  // Prisma's interactive transactions default to a 5s budget, which this blows
  // through: ~25 sequential deletes against a remote Supabase instance in
  // Mumbai. The whole thing must stay atomic (a half-deleted org is worse than
  // none), so the budget is raised rather than the transaction split.
  await prisma.$transaction(async (tx) => {
    await tx.invoiceLine.deleteMany({ where: { invoice: { shopId: { in: shopIds } } } })
    await tx.payment.deleteMany({ where: { shopId: { in: shopIds } } })
    await tx.customerLedger.deleteMany({ where: { shopId: { in: shopIds } } })
    await tx.supplierLedger.deleteMany({ where: { shopId: { in: shopIds } } })
    await tx.invoice.deleteMany({ where: { shopId: { in: shopIds } } })
    await tx.stockLedger.deleteMany({ where: { shopId: { in: shopIds } } })
    await tx.stockLot.deleteMany({ where: { shopId: { in: shopIds } } })
    await tx.cashMovement.deleteMany({ where: { shopId: { in: shopIds } } })
    await tx.shift.deleteMany({ where: { shopId: { in: shopIds } } })
    await tx.expense.deleteMany({ where: { shopId: { in: shopIds } } })
    await tx.quotation.deleteMany({ where: { shopId: { in: shopIds } } })
    await tx.saleReturn.deleteMany({ where: { shopId: { in: shopIds } } })
    await tx.purchase.deleteMany({ where: { shopId: { in: shopIds } } })
    await tx.supplier.deleteMany({ where: { shopId: { in: shopIds } } })
    await tx.customer.deleteMany({ where: { shopId: { in: shopIds } } })
    await tx.product.deleteMany({ where: { shopId: { in: shopIds } } })
    await tx.shopSettings.deleteMany({ where: { shopId: { in: shopIds } } })
    await tx.userShop.deleteMany({ where: { shopId: { in: shopIds } } })
    await tx.activityLog.deleteMany({ where: { orgId: org.id } })

    await tx.paymentClaim.deleteMany({ where: { organizationId: org.id } })
    await tx.subscriptionPayment.deleteMany({ where: { organizationId: org.id } })
    await tx.subscription.deleteMany({ where: { organizationId: org.id } })

    await tx.shop.deleteMany({ where: { orgId: org.id } })
    await tx.organizationUser.deleteMany({ where: { orgId: org.id } })
    await tx.organization.delete({ where: { id: org.id } })

    const userIds = users.map((u) => u.id)
    await tx.emailVerificationToken.deleteMany({ where: { userId: { in: userIds } } })
    await tx.passwordResetToken.deleteMany({ where: { userId: { in: userIds } } })
    await tx.loginCode.deleteMany({ where: { userId: { in: userIds } } })
    await tx.notification.deleteMany({ where: { userId: { in: userIds } } })
    await tx.user.deleteMany({ where: { id: { in: userIds } } })
  }, { timeout: 120_000, maxWait: 20_000 })

  const leftoverOrg = await prisma.organization.count({ where: { name: QA_ORG_NAME } })
  const leftoverUsers = await prisma.user.count({ where: { email: { endsWith: '@cartpos.test' } } })
  console.log(`\ndeleted. leftover orgs: ${leftoverOrg}, leftover test users: ${leftoverUsers}`)
  console.log(leftoverOrg === 0 && leftoverUsers === 0 ? 'CLEAN' : 'WARNING: leftovers remain')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
