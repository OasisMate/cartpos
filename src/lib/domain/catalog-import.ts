import { prisma } from '@/lib/db/prisma'
import { importProducts, type ImportRow, type ImportResult } from '@/lib/domain/product-import'
import { buildCatalogWhere } from '@/lib/domain/catalog'

/**
 * Turning catalog picks into real products.
 *
 * Separate from catalog.ts so the dependency runs one way: product-import may
 * import the catalog to contribute sightings, and never the reverse.
 */

export interface CatalogPick {
  id: string
  /** Shopkeeper's own price. Falls back to the suggestion when left blank. */
  price?: string | number | null
}

/**
 * Add picked catalog items to a shop as real products.
 *
 * Routed through importProducts() on purpose: dedup by barcode, price
 * validation, SKU generation and the STORE_MANAGER/PLATFORM_ADMIN check all
 * live there, and duplicating them here is how they drift apart.
 */
export async function addFromCatalog(
  shopId: string,
  userId: string,
  picks: CatalogPick[]
): Promise<ImportResult> {
  if (!Array.isArray(picks) || picks.length === 0) throw new Error('No products selected')

  const items = await prisma.catalogProduct.findMany({
    where: { id: { in: picks.map((p) => p.id) }, status: 'APPROVED' },
    select: { id: true, barcode: true, name: true, unit: true, category: true, suggestedPrice: true },
  })
  const byId = new Map(items.map((i) => [i.id, i]))

  const rows: ImportRow[] = []
  for (const pick of picks) {
    const item = byId.get(pick.id)
    if (!item) continue
    const price =
      pick.price === undefined || pick.price === null || String(pick.price).trim() === ''
        ? item.suggestedPrice?.toString()
        : pick.price
    rows.push({
      name: item.name,
      price: price ?? '',
      unit: item.unit,
      barcode: item.barcode,
      category: item.category ?? '',
      // Cost price is deliberately absent. The shopkeeper fills it in when they
      // know their own buying rate; a guess here would poison profit reporting.
      //
      // Stock tracking starts OFF. A shop onboarding today has counted nothing,
      // and turning it on would mark all two thousand products "Out" on day one
      // and make every stock report a lie. Rose Mart, the live reference shop,
      // runs with it off for 2,154 of its 2,157 products. They switch it on per
      // product once they actually start counting.
      trackStock: 'no',
    })
  }

  if (rows.length === 0) throw new Error('None of the selected products are available')

  // Picking from the catalog is itself a contribution: the shop now stocks these
  // items at its own prices, corroborating them and pulling the suggested price
  // towards what shops actually charge. importProducts records that for us.
  return importProducts(shopId, rows, userId)
}

/** Ceiling for one bulk add, matching importProducts' own per-call limit. */
const MAX_BULK = 5000

/**
 * Add everything matching the current filter, without ticking 2,000 boxes.
 *
 * A shop that stocks the usual kiryana range wants the whole catalog, or a whole
 * category, not a page of fifty at a time. The filter goes to the server rather
 * than two thousand ids going up from the browser, and prices come from the
 * catalog's suggestion - the shopkeeper edits them afterwards in the products
 * list, which is far quicker than typing each one into the picker.
 *
 * Items the shop already stocks are skipped by importProducts' barcode dedup,
 * so running this twice adds nothing the second time.
 */
export async function addAllFromCatalog(
  shopId: string,
  userId: string,
  filter: { vertical?: string | null; search?: string | null; category?: string | null }
): Promise<ImportResult & { truncated: boolean }> {
  const items = await prisma.catalogProduct.findMany({
    where: buildCatalogWhere(filter),
    select: { barcode: true, name: true, unit: true, category: true, suggestedPrice: true },
    orderBy: { name: 'asc' },
    take: MAX_BULK + 1,
  })

  const truncated = items.length > MAX_BULK
  const rows: ImportRow[] = items.slice(0, MAX_BULK).map((item) => ({
    name: item.name,
    price: item.suggestedPrice?.toString() ?? '',
    unit: item.unit,
    barcode: item.barcode,
    category: item.category ?? '',
    trackStock: 'no', // see addFromCatalog: nothing is counted on day one
  }))

  if (rows.length === 0) throw new Error('Nothing matches the current filter')

  const result = await importProducts(shopId, rows, userId)
  return { ...result, truncated }
}
