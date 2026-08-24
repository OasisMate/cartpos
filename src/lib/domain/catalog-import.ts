import { prisma } from '@/lib/db/prisma'
import { importProducts, type ImportRow, type ImportResult } from '@/lib/domain/product-import'

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
      trackStock: 'yes',
    })
  }

  if (rows.length === 0) throw new Error('None of the selected products are available')

  // Picking from the catalog is itself a contribution: the shop now stocks these
  // items at its own prices, corroborating them and pulling the suggested price
  // towards what shops actually charge. importProducts records that for us.
  return importProducts(shopId, rows, userId)
}
