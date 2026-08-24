import { PrismaClient, Prisma } from '@prisma/client'
import { readFileSync } from 'fs'
import { parseCSV } from '../src/lib/utils/csv'
import { normalizeCatalogBarcode, normalizeCatalogName } from '../src/lib/domain/catalog-taxonomy'

const prisma = new PrismaClient()

/**
 * Load a reviewed master-catalog CSV into the shared catalog.
 *
 *   npx tsx scripts/seed-master-catalog.ts <csvFile> [--source "Rose Mart"] [--dry-run]
 *
 * Seeded rows arrive APPROVED: they came from a real shop and a human read the
 * diff. Rows contributed later by shops start PENDING and need a second shop to
 * corroborate them (see lib/domain/catalog.ts).
 *
 * Idempotent - re-running updates names, units, categories and verticals in
 * place rather than duplicating. Prices are only filled where none is set, so a
 * median learned from live shops is never clobbered by a stale seed file.
 */
async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const sourceIdx = args.indexOf('--source')
  const sourceName = sourceIdx >= 0 ? args[sourceIdx + 1] : 'seed'
  const files = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--source')

  if (files.length === 0) {
    console.error(
      'Usage: npx tsx scripts/seed-master-catalog.ts <csvFile...> [--source "Rose Mart"] [--dry-run]'
    )
    process.exit(1)
  }

  // Several files layer, later ones winning per barcode. That is how a
  // hand-corrected file of previously-blank categories folds back over the
  // generated one without anyone editing 2,000 rows.
  const merged = new Map<string, Record<string, string>>()
  for (const file of files) {
    const parsed = parseCSV(readFileSync(file, 'utf8'))
    let overrides = 0
    for (const row of parsed) {
      const key = String(row.barcode ?? '').trim()
      if (!key) continue
      if (merged.has(key)) overrides++
      merged.set(key, row)
    }
    console.log(
      `Read ${parsed.length} rows from ${file}` + (overrides > 0 ? ` (${overrides} overrode earlier)` : '')
    )
  }
  const rows = [...merged.values()]

  let valid = 0
  let skipped = 0
  const seen = new Set<string>()
  const prepared: Prisma.CatalogProductCreateInput[] = []

  for (const r of rows) {
    const barcode = normalizeCatalogBarcode(r.barcode)
    const name = normalizeCatalogName(r.name ?? '')
    if (!barcode || !name) {
      skipped++
      continue
    }
    if (seen.has(barcode)) {
      skipped++
      continue
    }
    seen.add(barcode)

    const price = parseFloat(String(r.suggestedPrice ?? '').replace(/,/g, ''))
    const verticals = String(r.verticals ?? '')
      .split('|')
      .map((v) => v.trim().toUpperCase())
      .filter(Boolean)

    prepared.push({
      barcode,
      name,
      unit: (r.unit ?? '').trim() || 'pcs',
      category: (r.category ?? '').trim() || null,
      suggestedPrice:
        Number.isFinite(price) && price > 0 ? new Prisma.Decimal(price.toFixed(2)) : null,
      verticals,
      status: 'APPROVED',
      source: `seed:${sourceName}`,
    })
    valid++
  }

  const uncategorized = prepared.filter((p) => !p.category).length
  console.log(
    `Valid: ${valid}  |  skipped: ${skipped} (bad barcode / no name / duplicate)\n` +
      `Uncategorized: ${uncategorized}`
  )

  if (dryRun) {
    console.log('\n--dry-run: nothing written.')
    return
  }

  let created = 0
  let updated = 0
  for (const data of prepared) {
    const existing = await prisma.catalogProduct.findUnique({
      where: { barcode: data.barcode },
      select: { id: true, suggestedPrice: true },
    })

    if (existing) {
      await prisma.catalogProduct.update({
        where: { id: existing.id },
        data: {
          name: data.name,
          unit: data.unit,
          verticals: data.verticals,
          status: 'APPROVED',
          source: data.source,
          // Never overwrite a price the live shops have already taught us.
          ...(existing.suggestedPrice === null ? { suggestedPrice: data.suggestedPrice } : {}),
          // Nor a category someone has already sorted out by hand. A rebuilt CSV
          // arrives blank wherever the rules could not guess, and letting that
          // blank win would silently undo the manual pass every single time.
          ...(data.category ? { category: data.category } : {}),
        },
      })
      updated++
    } else {
      await prisma.catalogProduct.create({ data })
      created++
    }
  }

  const total = await prisma.catalogProduct.count({ where: { status: 'APPROVED' } })
  console.log(`\nCreated ${created}, updated ${updated}. Catalog now holds ${total} approved items.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
