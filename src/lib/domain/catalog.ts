import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { categorize, normalizeCatalogBarcode, normalizeCatalogName } from '@/lib/domain/catalog-taxonomy'

/**
 * The shared product catalog every shop picks from.
 *
 * A shop that signs up today has nothing in it, and nobody types two thousand
 * items by hand - the market expects a POS that is usable on day one. So we ship
 * a catalog: browse, tick, price, done.
 *
 * It stays current on its own. Every product a shop adds with a real barcode is
 * captured as a "sighting". An item corroborated by two independent shops is
 * promoted and becomes visible to everyone, which filters one shop's typos
 * without anyone reviewing a queue. Suggested price is the median across
 * sightings, so it tracks the market instead of freezing one shop's price.
 *
 * Sightings are internal. Which shop stocks what, at what price, is their
 * business - no API exposes them, only the aggregates derived from them.
 */

/** Column order for the reviewable master-catalog CSV. */
export const MASTER_CATALOG_HEADERS = [
  'barcode', 'name', 'unit', 'category', 'suggestedPrice', 'verticals',
]

/** Distinct contributing shops needed before a captured item goes live. */
export const PROMOTION_THRESHOLD = 2

export interface CatalogSearchParams {
  vertical?: string | null
  search?: string | null
  category?: string | null
  page?: number
  limit?: number
  /** Marks rows this shop already stocks, so the picker can grey them out. */
  shopId?: string | null
}

export interface CatalogItem {
  id: string
  barcode: string
  name: string
  unit: string
  category: string | null
  suggestedPrice: string | null
  alreadyAdded: boolean
}

/**
 * The filter behind both browsing and "add everything matching". Shared so the
 * count a shopkeeper is shown can never disagree with what the button adds.
 */
export function buildCatalogWhere(
  params: Pick<CatalogSearchParams, 'vertical' | 'search' | 'category'>
): Prisma.CatalogProductWhereInput {
  const search = params.search?.trim()
  const where: Prisma.CatalogProductWhereInput = { status: 'APPROVED' }
  if (params.vertical) where.verticals = { has: params.vertical }
  if (params.category) where.category = params.category
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      // Case-insensitive on barcode too: local codes carry letters
      // ("ALFB525267979", "http://myproduct.info/..."), so a lowercase typed
      // search would otherwise miss a product a scanner can find.
      { barcode: { contains: search, mode: 'insensitive' } },
    ]
  }
  return where
}

export async function searchCatalog(params: CatalogSearchParams) {
  const page = Math.max(1, params.page ?? 1)
  const limit = Math.min(100, Math.max(1, params.limit ?? 50))
  const where = buildCatalogWhere(params)

  const [total, items] = await Promise.all([
    prisma.catalogProduct.count({ where }),
    prisma.catalogProduct.findMany({
      where,
      orderBy: [{ name: 'asc' }],
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true, barcode: true, name: true, unit: true,
        category: true, suggestedPrice: true,
      },
    }),
  ])

  // Only the current page's barcodes are checked, so this stays cheap however
  // large the catalog grows.
  let owned = new Set<string>()
  if (params.shopId && items.length > 0) {
    const existing = await prisma.product.findMany({
      where: { shopId: params.shopId, barcode: { in: items.map((i) => i.barcode) } },
      select: { barcode: true },
    })
    owned = new Set(existing.map((e) => e.barcode).filter(Boolean) as string[])
  }

  return {
    items: items.map<CatalogItem>((i) => ({
      id: i.id,
      barcode: i.barcode,
      name: i.name,
      unit: i.unit,
      category: i.category,
      suggestedPrice: i.suggestedPrice ? i.suggestedPrice.toString() : null,
      alreadyAdded: owned.has(i.barcode),
    })),
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  }
}

/** Categories that actually have items, with counts, for the picker's filter. */
export async function listCatalogCategories(vertical?: string | null) {
  const where: Prisma.CatalogProductWhereInput = { status: 'APPROVED' }
  if (vertical) where.verticals = { has: vertical }

  const grouped = await prisma.catalogProduct.groupBy({
    by: ['category'],
    where,
    _count: { _all: true },
    orderBy: { category: 'asc' },
  })

  return grouped
    .filter((g) => g.category)
    .map((g) => ({ category: g.category as string, count: g._count._all }))
}

/**
 * Record that a shop stocks a barcoded product, growing the shared catalog.
 *
 * Best-effort by design: this runs alongside ordinary product creation, and a
 * catalog hiccup must never fail the shopkeeper's save. Callers get a boolean,
 * never an exception.
 */
export async function recordSighting(
  shopId: string,
  product: { barcode?: string | null; name: string; unit?: string | null; price?: unknown },
  vertical?: string | null
): Promise<boolean> {
  try {
    const barcode = normalizeCatalogBarcode(product.barcode)
    if (!barcode) return false
    const name = normalizeCatalogName(product.name)
    if (!name) return false

    const price = Number(product.price)
    const validPrice = Number.isFinite(price) && price > 0 && price < 100000000 ? price : null

    const entry =
      (await prisma.catalogProduct.findUnique({ where: { barcode }, select: { id: true, status: true } })) ??
      (await prisma.catalogProduct.create({
        data: {
          barcode,
          name,
          unit: product.unit?.trim() || 'pcs',
          category: categorize(name),
          verticals: vertical ? [vertical] : [],
          status: 'PENDING',
          source: 'contributed',
        },
        select: { id: true, status: true },
      }))

    // Unique on (catalogProductId, shopId): a shop re-adding the same item does
    // not count twice, so shopCount stays a count of distinct shops.
    const existing = await prisma.catalogSighting.findUnique({
      where: { catalogProductId_shopId: { catalogProductId: entry.id, shopId } },
      select: { id: true },
    })

    if (existing) {
      if (validPrice !== null) {
        await prisma.catalogSighting.update({
          where: { id: existing.id },
          data: { price: new Prisma.Decimal(validPrice) },
        })
      }
    } else {
      await prisma.catalogSighting.create({
        data: {
          catalogProductId: entry.id,
          shopId,
          price: validPrice !== null ? new Prisma.Decimal(validPrice) : null,
        },
      })
      if (vertical) {
        await prisma.catalogProduct.update({
          where: { id: entry.id },
          data: { verticals: { push: vertical } },
        }).catch(() => {})
      }
    }

    await refreshCatalogEntry(entry.id)
    return true
  } catch {
    return false
  }
}

/**
 * Bulk equivalent of recordSighting, for CSV import and catalog seeding.
 *
 * A shop importing its whole catalog is the single largest contribution event we
 * get, so it cannot run the per-row path: two thousand products would mean tens
 * of thousands of round trips. This does a handful of set-based statements
 * instead, and aggregates in SQL rather than pulling every sighting into memory.
 *
 * Best-effort, like its single-row sibling: never throws into the import.
 */
export async function recordSightingsBulk(
  shopId: string,
  items: Array<{ barcode?: string | null; name: string; unit?: string | null; price?: unknown }>,
  vertical?: string | null
): Promise<number> {
  try {
    const clean = new Map<string, { name: string; unit: string; price: number | null }>()
    for (const item of items) {
      const barcode = normalizeCatalogBarcode(item.barcode)
      const name = normalizeCatalogName(item.name ?? '')
      if (!barcode || !name || clean.has(barcode)) continue
      const price = Number(item.price)
      clean.set(barcode, {
        name,
        unit: item.unit?.trim() || 'pcs',
        price: Number.isFinite(price) && price > 0 && price < 100000000 ? price : null,
      })
    }
    if (clean.size === 0) return 0

    const barcodes = [...clean.keys()]

    // Create whatever the catalog has never seen. skipDuplicates absorbs races
    // with another shop importing the same barcode at the same moment.
    const known = await prisma.catalogProduct.findMany({
      where: { barcode: { in: barcodes } },
      select: { barcode: true },
    })
    const knownSet = new Set(known.map((k) => k.barcode))
    const missing = barcodes.filter((b) => !knownSet.has(b))

    if (missing.length > 0) {
      await prisma.catalogProduct.createMany({
        data: missing.map((barcode) => {
          const c = clean.get(barcode)!
          return {
            barcode,
            name: c.name,
            unit: c.unit,
            category: categorize(c.name),
            verticals: vertical ? [vertical] : [],
            status: 'PENDING' as const,
            source: 'contributed',
          }
        }),
        skipDuplicates: true,
      })
    }

    const entries = await prisma.catalogProduct.findMany({
      where: { barcode: { in: barcodes } },
      select: { id: true, barcode: true },
    })

    await prisma.catalogSighting.createMany({
      data: entries.map((e) => {
        const c = clean.get(e.barcode)!
        return {
          catalogProductId: e.id,
          shopId,
          price: c.price !== null ? new Prisma.Decimal(c.price) : null,
        }
      }),
      skipDuplicates: true,
    })

    await refreshCatalogEntries(entries.map((e) => e.id))
    return entries.length
  } catch {
    return 0
  }
}

/**
 * Set-based refresh of contributor counts, median prices and promotions.
 *
 * Done in SQL because the per-row path would be thousands of round trips after
 * a bulk import. percentile_cont gives us the true median; a shop that
 * fat-fingers 5,000 instead of 50 moves it not at all.
 */
export async function refreshCatalogEntries(ids: string[]): Promise<void> {
  if (ids.length === 0) return

  await prisma.$executeRaw`
    UPDATE "CatalogProduct" cp
    SET "shopCount" = agg.shops,
        "suggestedPrice" = CASE
          -- A curated seed price is worth more than one shop's opinion, so a
          -- single sighting never overrides it. Two shops agreeing is evidence.
          WHEN agg.priced >= 2 THEN agg.median
          WHEN cp."suggestedPrice" IS NULL THEN agg.median
          ELSE cp."suggestedPrice"
        END
    FROM (
      SELECT "catalogProductId" AS id,
             COUNT(DISTINCT "shopId") AS shops,
             COUNT("price") AS priced,
             percentile_cont(0.5) WITHIN GROUP (ORDER BY "price") AS median
      FROM "CatalogSighting"
      WHERE "catalogProductId" = ANY(${ids}::text[])
      GROUP BY "catalogProductId"
    ) agg
    WHERE cp.id = agg.id
  `

  // Promotion is a separate statement so it reads off the counts just written.
  // REJECTED is a human decision and is never reversed automatically.
  await prisma.$executeRaw`
    UPDATE "CatalogProduct"
    SET "status" = 'APPROVED'
    WHERE id = ANY(${ids}::text[])
      AND "status" = 'PENDING'
      AND "shopCount" >= ${PROMOTION_THRESHOLD}
  `
}

/**
 * Recompute an entry's contributor count, suggested price and status.
 *
 * Median rather than mean: one shop that fat-fingers 5,000 instead of 50 would
 * drag an average badly, and a median shrugs it off.
 */
export async function refreshCatalogEntry(catalogProductId: string): Promise<void> {
  const sightings = await prisma.catalogSighting.findMany({
    where: { catalogProductId },
    select: { shopId: true, price: true },
  })

  const shopCount = new Set(sightings.map((s) => s.shopId)).size
  const prices = sightings
    .map((s) => (s.price === null ? NaN : Number(s.price)))
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b)

  let median: number | null = null
  if (prices.length > 0) {
    const mid = Math.floor(prices.length / 2)
    median = prices.length % 2 === 0 ? (prices[mid - 1] + prices[mid]) / 2 : prices[mid]
  }

  const current = await prisma.catalogProduct.findUnique({
    where: { id: catalogProductId },
    select: { status: true, suggestedPrice: true },
  })
  if (!current) return

  // A curated seed price is worth more than one shop's opinion, so a single
  // sighting never overrides it - two shops agreeing is evidence, one is not.
  // An entry with no price yet takes whatever it can get.
  const takePrice = median !== null && (prices.length >= 2 || current.suggestedPrice === null)

  // Seeded rows arrive APPROVED and stay there. Contributed rows go live once a
  // second shop corroborates them. REJECTED is a manual decision and is never
  // undone automatically.
  const status =
    current.status === 'PENDING' && shopCount >= PROMOTION_THRESHOLD ? 'APPROVED' : current.status

  await prisma.catalogProduct.update({
    where: { id: catalogProductId },
    data: {
      shopCount,
      status,
      ...(takePrice ? { suggestedPrice: new Prisma.Decimal(median!.toFixed(2)) } : {}),
    },
  })
}
