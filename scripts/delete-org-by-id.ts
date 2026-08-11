/**
 * Delete ONE organisation by explicit id, with everything under it.
 *
 * For removing a test signup made through the real front door. Deliberately
 * takes an id rather than a name: names collide (a test org called "cartpos"
 * sits alongside the "CartPOS Demo" fixture with 1300+ invoices), and a
 * destructive script that guesses is a script that eventually deletes the wrong
 * shop.
 *
 * Guards, all of which stop the run rather than ask:
 *   - refuses a demo fixture (isDemo)
 *   - refuses an org holding invoices unless --force is given
 *   - only removes users whose ONLY membership is this org, so a person who
 *     also belongs elsewhere is never deleted
 *
 * Run: npx tsx scripts/delete-org-by-id.ts <orgId>
 *      npx tsx scripts/delete-org-by-id.ts <orgId> --confirm
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const orgId = process.argv[2]
const CONFIRM = process.argv.includes('--confirm')
const FORCE = process.argv.includes('--force')

async function main() {
  if (!orgId || orgId.startsWith('--')) {
    console.error('Pass the organisation id. Find it with scripts/qa/inspect-org.ts <name>')
    process.exit(1)
  }

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    include: {
      shops: { select: { id: true, name: true } },
      users: { select: { userId: true } },
    },
  })

  if (!org) {
    console.error(`No organisation with id ${orgId}`)
    process.exit(1)
  }

  if (org.isDemo) {
    console.error(`REFUSING: "${org.name}" is the demo fixture. It is reused for testing and must not be deleted.`)
    process.exit(1)
  }

  const shopIds = org.shops.map((s) => s.id)
  const invoices = await prisma.invoice.count({ where: { shopId: { in: shopIds } } })

  console.log(`ORG        ${org.name}`)
  console.log(`  id         ${org.id}`)
  console.log(`  status     ${org.status}`)
  console.log(`  created    ${org.createdAt.toISOString()}`)
  console.log(`  shops      ${shopIds.length}`)
  console.log(`  invoices   ${invoices}`)

  if (invoices > 0 && !FORCE) {
    console.error(
      `\nREFUSING: this org has ${invoices} invoice(s), so it holds real sales history.\n` +
        `If you are certain, re-run with --force --confirm.`
    )
    process.exit(1)
  }

  // Only users who belong to NO other organisation and NO other shop.
  const memberIds = new Set<string>(org.users.map((u) => u.userId))
  const seats = await prisma.userShop.findMany({
    where: { shopId: { in: shopIds } },
    select: { userId: true },
  })
  seats.forEach((s) => memberIds.add(s.userId))

  const deletableUsers: Array<{ id: string; email: string }> = []
  const keptUsers: string[] = []
  for (const userId of memberIds) {
    const [otherOrgs, otherShops, user] = await Promise.all([
      prisma.organizationUser.count({ where: { userId, orgId: { not: orgId } } }),
      prisma.userShop.count({ where: { userId, shopId: { notIn: shopIds } } }),
      prisma.user.findUnique({ where: { id: userId }, select: { email: true, role: true } }),
    ])
    if (!user) continue
    if (user.role === 'PLATFORM_ADMIN') {
      keptUsers.push(`${user.email} (platform admin)`)
      continue
    }
    if (otherOrgs > 0 || otherShops > 0) {
      keptUsers.push(`${user.email} (belongs elsewhere too)`)
      continue
    }
    deletableUsers.push({ id: userId, email: user.email })
  }

  console.log(`  users to delete: ${deletableUsers.map((u) => u.email).join(', ') || '(none)'}`)
  if (keptUsers.length) console.log(`  users KEPT:      ${keptUsers.join(', ')}`)

  if (!CONFIRM) {
    console.log('\nDRY RUN. Re-run with --confirm to delete.')
    return
  }

  await prisma.$transaction(
    async (tx) => {
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
      await tx.activityLog.deleteMany({ where: { orgId } })

      await tx.paymentClaim.deleteMany({ where: { organizationId: orgId } })
      await tx.subscriptionPayment.deleteMany({ where: { organizationId: orgId } })
      await tx.subscription.deleteMany({ where: { organizationId: orgId } })

      await tx.shop.deleteMany({ where: { orgId } })
      await tx.organizationUser.deleteMany({ where: { orgId } })
      await tx.organization.delete({ where: { id: orgId } })

      const ids = deletableUsers.map((u) => u.id)
      if (ids.length) {
        await tx.emailVerificationToken.deleteMany({ where: { userId: { in: ids } } })
        await tx.passwordResetToken.deleteMany({ where: { userId: { in: ids } } })
        await tx.loginCode.deleteMany({ where: { userId: { in: ids } } })
        await tx.notification.deleteMany({ where: { userId: { in: ids } } })
        await tx.user.deleteMany({ where: { id: { in: ids } } })
      }
    },
    // Sequential deletes against Supabase Mumbai exceed Prisma's 5s default.
    { timeout: 120_000, maxWait: 20_000 }
  )

  const gone = (await prisma.organization.count({ where: { id: orgId } })) === 0
  const usersGone =
    deletableUsers.length === 0 ||
    (await prisma.user.count({ where: { id: { in: deletableUsers.map((u) => u.id) } } })) === 0

  console.log(`\ndeleted. org removed: ${gone} | users removed: ${usersGone}`)
  console.log(gone && usersGone ? 'CLEAN' : 'WARNING: leftovers remain')
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
