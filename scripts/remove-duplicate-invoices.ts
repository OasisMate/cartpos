/**
 * Removes duplicate invoices that share the same (shopId, number) — e.g. from the
 * double-sync bug. Keeps the oldest row (createdAt, then id); deletes the rest and
 * reverses their stock / customer / payment rows like deleteSale.
 *
 * Usage:
 *   npx tsx scripts/remove-duplicate-invoices.ts           # dry-run (default)
 *   npx tsx scripts/remove-duplicate-invoices.ts --execute # actually delete
 *   npx tsx scripts/remove-duplicate-invoices.ts --execute --shopId=cxxx...
 */

import { PrismaClient } from '@prisma/client'
import { deleteInvoicePhysically } from './lib/deleteInvoicePhysically'

const prisma = new PrismaClient()

type DupGroup = { shopId: string; number: string; cnt: bigint }

async function main() {
  const execute = process.argv.includes('--execute')
  const shopArg = process.argv.find((a) => a.startsWith('--shopId='))
  const onlyShopId = shopArg ? shopArg.split('=')[1]?.trim() : undefined

  const groups = await prisma.$queryRaw<DupGroup[]>`
    SELECT "shopId", "number", COUNT(*)::bigint AS cnt
    FROM "Invoice"
    WHERE "number" IS NOT NULL
      AND TRIM("number") <> ''
    GROUP BY "shopId", "number"
    HAVING COUNT(*) > 1
  `

  const filtered = onlyShopId ? groups.filter((g) => g.shopId === onlyShopId) : groups

  if (filtered.length === 0) {
    console.log('No duplicate (shopId, number) groups found.')
    await prisma.$disconnect()
    return
  }

  console.log(
    execute
      ? 'EXECUTE mode — deleting duplicate invoices…'
      : 'DRY RUN — no deletes. Pass --execute to apply.\n'
  )

  let deleteCount = 0

  for (const g of filtered) {
    const rows = await prisma.invoice.findMany({
      where: { shopId: g.shopId, number: g.number },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        createdAt: true,
        status: true,
        total: true,
        clientSaleId: true,
      },
    })

    const [keeper, ...victims] = rows
    console.log(
      `\nShop ${g.shopId}  invoice #${g.number}  (${rows.length} copies) — keep ${keeper.id} (${keeper.createdAt.toISOString()}, ${keeper.status})`
    )
    for (const v of victims) {
      console.log(
        `  ${execute ? 'DELETE' : 'would delete'} ${v.id}  ${v.createdAt.toISOString()}  ${v.status}  total=${v.total}  clientSaleId=${v.clientSaleId ?? 'null'}`
      )
      if (execute) {
        await deleteInvoicePhysically(prisma, v.id, g.shopId)
        deleteCount++
      }
    }
  }

  if (execute) {
    console.log(`\nDone. Removed ${deleteCount} duplicate invoice(s).`)
  } else {
    console.log(`\nDry run complete. ${filtered.length} group(s); pass --execute to delete duplicates.`)
  }

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  prisma.$disconnect()
  process.exit(1)
})
