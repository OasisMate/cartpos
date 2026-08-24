import { PrismaClient } from '@prisma/client'
import { writeFileSync } from 'fs'
import { toCSV } from '../src/lib/utils/csv'
import {
  categorize,
  normalizeCatalogBarcode,
  normalizeCatalogName,
} from '../src/lib/domain/catalog-taxonomy'
import { MASTER_CATALOG_HEADERS } from '../src/lib/domain/catalog'

const prisma = new PrismaClient()

/**
 * Turn a real shop's catalog into a reviewable master-catalog CSV.
 *
 *   npx tsx scripts/build-master-catalog.ts <shopId> [outFile]
 *
 * Read-only against the source shop. Output is a file for a human to check,
 * NOT a database write: seeding is a separate, deliberate step
 * (scripts/seed-master-catalog.ts).
 *
 * Commercially sensitive columns never appear. Cost and trade prices are the
 * source shop's supplier terms. Only retail travels, because it is printed on
 * the packet, and it travels as a suggestion the new shop overwrites.
 */

/** Verticals a Pakistani grocery-shaped catalog is offered to. */
const GROCERY_VERTICALS = [
  'RETAIL_STORE', 'KIRYANA_STORE', 'GENERAL_STORE', 'CONVENIENCE_STORE', 'SUPERMARKET',
]

async function main() {
  const [shopId, outFile = 'data/master-catalog/retail-pk.csv'] = process.argv.slice(2)
  if (!shopId) {
    console.error('Usage: npx tsx scripts/build-master-catalog.ts <shopId> [outFile]')
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
    select: { name: true, barcode: true, unit: true, price: true, category: true },
  })

  // Dedupe by barcode. Where two rows share one, keep the longer name: shop data
  // tends to abbreviate on re-entry, and the fuller name is the useful one.
  const byBarcode = new Map<string, { name: string; unit: string; price: number; category: string | null }>()
  let noBarcode = 0
  let malformed = 0
  let duplicates = 0

  for (const p of products) {
    const barcode = normalizeCatalogBarcode(p.barcode)
    if (!barcode) {
      if (p.barcode && String(p.barcode).trim()) malformed++
      else noBarcode++
      continue
    }
    const name = normalizeCatalogName(p.name)
    if (!name) continue

    const existing = byBarcode.get(barcode)
    if (existing) {
      duplicates++
      if (name.length <= existing.name.length) continue
    }
    byBarcode.set(barcode, {
      name,
      unit: p.unit?.trim() || 'pcs',
      price: Number(p.price),
      category: p.category?.trim() || null,
    })
  }

  let autoCategorized = 0
  let keptExisting = 0
  const rows = [...byBarcode.entries()]
    .map(([barcode, p]) => {
      // A category already typed by the shopkeeper beats a guess from a regex.
      let category = p.category
      if (category) keptExisting++
      else {
        category = categorize(p.name)
        if (category) autoCategorized++
      }
      return {
        barcode,
        name: p.name,
        unit: p.unit,
        category: category ?? '',
        suggestedPrice: Number.isFinite(p.price) && p.price > 0 ? p.price.toFixed(2) : '',
        verticals: GROCERY_VERTICALS.join('|'),
      }
    })
    .sort((a, b) => (a.category || 'zzz').localeCompare(b.category || 'zzz') || a.name.localeCompare(b.name))

  writeFileSync(outFile, toCSV(MASTER_CATALOG_HEADERS, rows), 'utf8')

  const uncategorized = rows.filter((r) => !r.category).length
  const pct = (n: number) => (rows.length ? Math.round((n / rows.length) * 100) : 0)

  console.log(
    `Source          : ${shop.organization.name} / ${shop.name} (${shop.organization.type})\n` +
      `Read            : ${products.length} active products\n` +
      `  no barcode    : ${noBarcode} (dropped - catalog is barcode-keyed)\n` +
      `  malformed     : ${malformed} (dropped - QR payloads / shop-local codes)\n` +
      `  duplicate bc  : ${duplicates} (merged)\n` +
      `\nWrote           : ${rows.length} rows to ${outFile}\n` +
      `  kept existing : ${keptExisting} categories\n` +
      `  auto-assigned : ${autoCategorized}\n` +
      `  UNCATEGORIZED : ${uncategorized} (${pct(uncategorized)}%) <- fill these in before seeding\n` +
      `\nNothing was written to the database. Review the CSV, then run:\n` +
      `  npx tsx scripts/seed-master-catalog.ts ${outFile}\n`
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
