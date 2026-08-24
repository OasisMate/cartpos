import { PrismaClient } from '@prisma/client'
import { importProducts } from '../src/lib/domain/product-import'
import { catalogSlugForOrgType, loadCatalog } from '../src/lib/domain/starter-catalog'

const prisma = new PrismaClient()

/**
 * Load a starter catalog into a shop, for hands-on onboarding.
 *
 *   npx tsx scripts/seed-catalog.ts <shopId> [slug] [--dry-run]
 *
 * The slug defaults to whatever suits the org's vertical. Runs through the same
 * importProducts() the UI uses, so dedup-by-barcode and validation are identical.
 */
async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const [shopId, slugArg] = args.filter((a) => !a.startsWith('--'))

  if (!shopId) {
    console.error('Usage: npx tsx scripts/seed-catalog.ts <shopId> [slug] [--dry-run]')
    process.exit(1)
  }

  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    select: {
      name: true,
      organization: { select: { name: true, type: true, isDemo: true } },
      _count: { select: { products: true } },
    },
  })
  if (!shop) {
    console.error(`No shop found with id ${shopId}`)
    process.exit(1)
  }

  const slug = slugArg || catalogSlugForOrgType(shop.organization.type)
  if (!slug) {
    console.error(`No starter catalog defined for org type ${shop.organization.type}`)
    process.exit(1)
  }

  const catalog = loadCatalog(slug)
  if (!catalog) {
    console.error(`Catalog "${slug}" is missing or empty (data/starter-catalogs/${slug}.csv)`)
    process.exit(1)
  }

  console.log(
    `Shop:      ${shop.organization.name} / ${shop.name} (${shop.organization.type})\n` +
      `Catalog: ${catalog.label} (${catalog.rows.length} products)\n` +
      `Existing:  ${shop._count.products} products already in this shop`
  )

  if (dryRun) {
    console.log('\n--dry-run: nothing written.')
    return
  }

  // Seeding needs an actor importProducts will accept.
  const actor =
    (await prisma.user.findFirst({
      where: { shops: { some: { shopId, shopRole: 'STORE_MANAGER' } } },
      select: { id: true, name: true },
    })) ??
    (await prisma.user.findFirst({
      where: { role: 'PLATFORM_ADMIN' },
      select: { id: true, name: true },
    }))

  if (!actor) {
    console.error('No store manager or platform admin found to attribute the import to')
    process.exit(1)
  }

  const result = await importProducts(shopId, catalog.rows, actor.id)
  console.log(
    `\nCreated ${result.created}, skipped ${result.skipped} (as ${actor.name})`
  )
  for (const e of result.errors.slice(0, 10)) {
    console.log(`  row ${e.row} ${e.name}: ${e.message}`)
  }
  if (result.errors.length > 10) console.log(`  ...and ${result.errors.length - 10} more`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
