import { PrismaClient } from '@prisma/client'
import { writeFileSync } from 'fs'
import { toCSV } from '../src/lib/utils/csv'
import { CATALOG_HEADERS } from '../src/lib/domain/starter-catalog'

const prisma = new PrismaClient()

/**
 * Dump one shop's live catalog into the product-import CSV format, so a
 * curated real shop can become a starter catalog for new signups.
 *
 *   npx tsx scripts/export-catalog.ts <shopId> [outFile]
 *
 * Commercially sensitive columns are deliberately dropped: cost, trade and
 * carton pricing are the source shop's supplier terms and must never travel
 * into another org's catalog. Retail price DOES travel, because packaged FMCG
 * in Pakistan is largely printed MRP, so it is a sane default the new shop
 * corrects where it differs. Stock is never exported (catalog only).
 */
async function main() {
  const [shopId, outFile] = process.argv.slice(2)
  if (!shopId) {
    console.error('Usage: npx tsx scripts/export-catalog.ts <shopId> [outFile]')
    process.exit(1)
  }

  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    select: { name: true, organization: { select: { name: true, type: true } } },
  })
  if (!shop) {
    console.error(`No shop found with id ${shopId}`)
    process.exit(1)
  }

  const products = await prisma.product.findMany({
    where: { shopId, archivedAt: null },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
    select: {
      name: true, barcode: true, unit: true, price: true,
      category: true, cartonSize: true, reorderLevel: true, trackStock: true,
    },
  })

  const rows = products.map((p) => ({
    name: p.name,
    price: p.price.toString(),
    unit: p.unit,
    barcode: p.barcode ?? '',
    category: p.category ?? '',
    cartonSize: p.cartonSize ?? '',
    reorderLevel: p.reorderLevel ?? '',
    trackStock: p.trackStock ? 'yes' : 'no',
  }))

  const csv = toCSV(CATALOG_HEADERS, rows)
  const withBarcode = rows.filter((r) => r.barcode).length

  if (outFile) {
    writeFileSync(outFile, csv, 'utf8')
    console.log(`Wrote ${rows.length} products to ${outFile}`)
  } else {
    process.stdout.write(csv)
  }

  console.error(
    `\nSource: ${shop.organization.name} / ${shop.name} (${shop.organization.type})\n` +
      `Products: ${rows.length}  |  with barcode: ${withBarcode} (${
        rows.length ? Math.round((withBarcode / rows.length) * 100) : 0
      }%)\n` +
      `Dropped columns: costPrice, tradePrice, cartonPrice, cartonBarcode, sku, stock\n`
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
