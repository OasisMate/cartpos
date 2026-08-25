import { prisma } from '@/lib/db/prisma'
import { PurchaseListStatus } from '@prisma/client'
import { checkPurchasePermission, createPurchase, getProductStockBatch } from '@/lib/domain/purchases'
import { rankSuggestions } from '@/lib/purchaseLists/suggestions'

/**
 * Purchase lists: the reorder chit. Rules live here, routes stay thin.
 * Every function is shop-scoped and refuses a list from another shop.
 */

export interface PurchaseListFilters {
  status?: PurchaseListStatus
  supplierId?: string
  page?: number
  limit?: number
}

export interface CreatePurchaseListInput {
  name?: string
  supplierId?: string
  notes?: string
}

export interface UpdatePurchaseListInput {
  name?: string
  supplierId?: string | null
  notes?: string
  status?: 'DRAFT' | 'SENT'
}

const LINE_SELECT = {
  id: true,
  quantity: true,
  packName: true,
  unitsPerItem: true,
  note: true,
  product: {
    select: {
      id: true,
      name: true,
      unit: true,
      barcode: true,
      cartonSize: true,
      packagingLevels: { select: { name: true, factorToBase: true, level: true } },
    },
  },
} as const

export interface PackOption {
  packName: string | null
  unitsPerItem: number
  label: string
}

/**
 * The units a product can be ordered in, smallest last. A shop orders in the
 * biggest pack it stocks, so the first entry is the default.
 */
export function packOptionsForProduct(product: {
  unit: string
  cartonSize?: number | null
  packagingLevels?: { name: string; factorToBase: unknown; level: number }[]
}): PackOption[] {
  const options: PackOption[] = []

  for (const level of product.packagingLevels ?? []) {
    const factor = Number(level.factorToBase)
    if (!Number.isFinite(factor) || factor <= 1) continue
    options.push({ packName: level.name, unitsPerItem: factor, label: level.name })
  }
  options.sort((a, b) => b.unitsPerItem - a.unitsPerItem)

  // Legacy carton, only when no packaging level already covers that size.
  const cartonSize = product.cartonSize ?? 0
  if (cartonSize > 1 && !options.some((o) => o.unitsPerItem === cartonSize)) {
    options.push({ packName: 'Carton', unitsPerItem: cartonSize, label: 'Carton' })
    options.sort((a, b) => b.unitsPerItem - a.unitsPerItem)
  }

  options.push({ packName: null, unitsPerItem: 1, label: product.unit })
  return options
}

/**
 * Match a caller-named pack against the product's own options. Never trust a
 * unitsPerItem from the request: a wrong factor multiplies into the stock
 * ledger when the list is received, so the factor always comes from here.
 */
function matchPackOption(packName: string | null | undefined, options: PackOption[]): PackOption {
  const wanted = packName ?? null
  const match = options.find((o) => o.packName === wanted)
  if (!match) throw new Error('That pack is not available for this product')
  return match
}

async function requireList(id: string, userId: string) {
  const list = await prisma.purchaseList.findUnique({
    where: { id },
    include: { lines: { select: LINE_SELECT, orderBy: { createdAt: 'asc' } }, supplier: true },
  })
  if (!list) throw new Error('Purchase list not found')
  const allowed = await checkPurchasePermission(userId, list.shopId)
  if (!allowed) throw new Error('You do not have permission to work on purchase lists in this shop')
  return list
}

export async function listPurchaseLists(shopId: string, filters: PurchaseListFilters = {}) {
  const page = Math.max(1, filters.page || 1)
  const limit = Math.min(100, Math.max(1, filters.limit || 20))
  const where = {
    shopId,
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.supplierId ? { supplierId: filters.supplierId } : {}),
  }
  const [lists, total] = await Promise.all([
    prisma.purchaseList.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        name: true,
        status: true,
        notes: true,
        sentAt: true,
        purchaseId: true,
        createdAt: true,
        supplier: { select: { id: true, name: true } },
        _count: { select: { lines: true } },
      },
    }),
    prisma.purchaseList.count({ where }),
  ])
  return { lists, total, page, limit }
}

export async function getPurchaseList(id: string, userId: string) {
  return requireList(id, userId)
}

export async function createPurchaseList(
  shopId: string,
  input: CreatePurchaseListInput,
  userId: string
) {
  const allowed = await checkPurchasePermission(userId, shopId)
  if (!allowed) throw new Error('You do not have permission to create purchase lists in this shop')

  if (input.supplierId) {
    const supplier = await prisma.supplier.findUnique({ where: { id: input.supplierId } })
    if (!supplier || supplier.shopId !== shopId) throw new Error('Invalid supplier')
  }

  return prisma.purchaseList.create({
    data: {
      shopId,
      name: input.name?.trim() || null,
      supplierId: input.supplierId || null,
      notes: input.notes?.trim() || null,
      createdByUserId: userId,
    },
  })
}

export async function updatePurchaseList(
  id: string,
  input: UpdatePurchaseListInput,
  userId: string
) {
  const list = await requireList(id, userId)
  if (list.status === 'RECEIVED') throw new Error('This list has already been received')
  if ((input.status as string) === 'RECEIVED') {
    throw new Error('A list becomes received by receiving it, not by editing it')
  }

  if (input.supplierId) {
    const supplier = await prisma.supplier.findUnique({ where: { id: input.supplierId } })
    if (!supplier || supplier.shopId !== list.shopId) throw new Error('Invalid supplier')
  }

  // SENT is stamped by the share/print action. The list stays editable after it.
  const goingOut = input.status === 'SENT' && list.status !== 'SENT'

  return prisma.purchaseList.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() || null } : {}),
      ...(input.supplierId !== undefined ? { supplierId: input.supplierId || null } : {}),
      ...(input.notes !== undefined ? { notes: input.notes.trim() || null } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(goingOut ? { sentAt: new Date() } : {}),
    },
  })
}

export async function addOrBumpLine(
  id: string,
  input: { productId: string; quantity: number; packName?: string | null; unitsPerItem?: number },
  userId: string
) {
  const list = await requireList(id, userId)
  if (list.status === 'RECEIVED') throw new Error('This list has already been received')
  if (!input.quantity || input.quantity <= 0) throw new Error('Quantity must be greater than 0')

  const product = await prisma.product.findUnique({
    where: { id: input.productId },
    select: {
      shopId: true,
      unit: true,
      cartonSize: true,
      packagingLevels: { select: { name: true, factorToBase: true, level: true } },
    },
  })
  if (!product || product.shopId !== list.shopId) throw new Error('Product not found in this shop')

  // Never trust unitsPerItem from the caller: it multiplies into the stock ledger
  // when the list is received, so the factor always comes from the product's own
  // packaging options, not the request body.
  const options = packOptionsForProduct(product)
  const pack = input.packName !== undefined ? matchPackOption(input.packName, options) : options[0]

  // The unique index does the merging: scanning the same item twice bumps the
  // quantity instead of leaving two lines for one product. Re-scanning bumps the
  // count in the unit the line already carries, so the pack is set on create only.
  return prisma.purchaseListLine.upsert({
    where: { purchaseListId_productId: { purchaseListId: id, productId: input.productId } },
    update: { quantity: { increment: input.quantity } },
    create: {
      purchaseListId: id,
      productId: input.productId,
      quantity: input.quantity,
      packName: pack.packName,
      unitsPerItem: pack.unitsPerItem,
    },
    select: LINE_SELECT,
  })
}

export async function updateLine(
  lineId: string,
  input: { quantity?: number; note?: string; packName?: string | null; unitsPerItem?: number },
  userId: string
) {
  const line = await prisma.purchaseListLine.findUnique({
    where: { id: lineId },
    include: {
      purchaseList: { select: { id: true, shopId: true, status: true } },
      product: {
        select: {
          unit: true,
          cartonSize: true,
          packagingLevels: { select: { name: true, factorToBase: true, level: true } },
        },
      },
    },
  })
  if (!line) throw new Error('Line not found')
  const allowed = await checkPurchasePermission(userId, line.purchaseList.shopId)
  if (!allowed) throw new Error('You do not have permission to work on purchase lists in this shop')
  if (line.purchaseList.status === 'RECEIVED') throw new Error('This list has already been received')
  if (input.quantity !== undefined && input.quantity <= 0) {
    throw new Error('Quantity must be greater than 0')
  }

  // As with addOrBumpLine, the factor is never taken from the request: it is
  // looked up fresh from the product's own packaging options.
  const pack =
    input.packName !== undefined
      ? matchPackOption(input.packName, packOptionsForProduct(line.product))
      : undefined

  return prisma.purchaseListLine.update({
    where: { id: lineId },
    data: {
      // Changing the unit leaves the number alone (4 pcs becomes 4 pet).
      ...(input.quantity !== undefined ? { quantity: input.quantity } : {}),
      ...(input.note !== undefined ? { note: input.note.trim() || null } : {}),
      ...(pack ? { packName: pack.packName, unitsPerItem: pack.unitsPerItem } : {}),
    },
    select: LINE_SELECT,
  })
}

export async function removeLine(lineId: string, userId: string) {
  const line = await prisma.purchaseListLine.findUnique({
    where: { id: lineId },
    include: { purchaseList: { select: { shopId: true, status: true } } },
  })
  if (!line) throw new Error('Line not found')
  const allowed = await checkPurchasePermission(userId, line.purchaseList.shopId)
  if (!allowed) throw new Error('You do not have permission to work on purchase lists in this shop')
  if (line.purchaseList.status === 'RECEIVED') throw new Error('This list has already been received')

  await prisma.purchaseListLine.delete({ where: { id: lineId } })
}

export async function deletePurchaseList(id: string, userId: string) {
  const list = await requireList(id, userId)
  if (list.status === 'RECEIVED') throw new Error('A received list is history and cannot be deleted')
  await prisma.purchaseList.delete({ where: { id } })
}

export interface SuggestionRow {
  productId: string
  name: string
  unit: string
  barcode: string | null
  reason: 'LOW_STOCK' | 'SOLD_RECENTLY'
  shortfall?: number
  baseUnitsSold?: number
}

export interface SuggestReorderItemsResult {
  suggestions: SuggestionRow[]
  // Whether the shop has ever completed a sale, independent of the days window.
  // A shop with old sales that fall outside the window is not a new shop, and
  // the empty-suggestions copy needs to tell those two cases apart honestly.
  hasAnySales: boolean
}

/**
 * What the shop probably needs to buy. Two signals, because most shops here run
 * with stock tracking off: products under their reorder level (only meaningful
 * when trackStock is on), then whatever actually sold in the window.
 */
export async function suggestReorderItems(
  shopId: string,
  options: { days?: number; limit?: number; excludeListId?: string } = {}
): Promise<SuggestReorderItemsResult> {
  const days = Math.min(365, Math.max(1, options.days ?? 30))
  const limit = Math.min(100, Math.max(1, options.limit ?? 50))
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  const tracked = await prisma.product.findMany({
    where: { shopId, trackStock: true, reorderLevel: { gt: 0 } },
    select: { id: true, reorderLevel: true },
  })
  const trackedIds = tracked.map((p) => p.id)

  const [stockByProduct, soldRows, onList, anySale] = await Promise.all([
    getProductStockBatch(shopId, trackedIds),
    prisma.$queryRaw<{ productId: string; sold: number }[]>`
      SELECT il."productId" AS "productId",
             SUM(il."quantity" * il."unitsPerItem")::float AS "sold"
      FROM "InvoiceLine" il
      JOIN "Invoice" i ON i."id" = il."invoiceId"
      WHERE i."shopId" = ${shopId}
        AND i."status" = 'COMPLETED'
        AND i."createdAt" >= ${since}
      GROUP BY il."productId"
      ORDER BY "sold" DESC
      LIMIT 200
    `,
    options.excludeListId
      ? prisma.purchaseListLine.findMany({
          where: { purchaseListId: options.excludeListId, purchaseList: { shopId } },
          select: { productId: true },
        })
      : Promise.resolve([]),
    prisma.invoice.findFirst({
      where: { shopId, status: 'COMPLETED' },
      select: { id: true },
    }),
  ])

  const ranked = rankSuggestions({
    lowStock: tracked.map((p) => ({
      productId: p.id,
      onHand: stockByProduct.get(p.id) ?? 0,
      reorderLevel: Number(p.reorderLevel ?? 0),
    })),
    sold: soldRows.map((r) => ({ productId: r.productId, baseUnitsSold: Number(r.sold) })),
    excludeProductIds: onList.map((l) => l.productId),
    limit,
  })

  const products = await prisma.product.findMany({
    where: { id: { in: ranked.map((r) => r.productId) }, shopId },
    select: { id: true, name: true, unit: true, barcode: true },
  })
  const byId = new Map(products.map((p) => [p.id, p]))

  const suggestions = ranked
    .map((r) => {
      const product = byId.get(r.productId)
      if (!product) return null
      return { ...r, name: product.name, unit: product.unit, barcode: product.barcode }
    })
    .filter((row): row is SuggestionRow => row !== null)

  return { suggestions, hasAnySales: anySale !== null }
}

export interface ReceivePurchaseListInput {
  lines: { productId: string; quantity: number; unitCost?: number }[]
  supplierId?: string
  date?: Date
  reference?: string
  notes?: string
  onCredit?: boolean
  /** Base64 data URLs, already downscaled by the browser. */
  images?: string[]
}

/**
 * Turn a list into a real stock-in.
 *
 * The shop sells in pieces but buys in packs (a pet of 6 cold drinks, ordered
 * one pet at a time). createPurchase knows nothing about packs: it works
 * purely in base units and per-base-unit cost. So the conversion happens
 * here, using each line's own stored unitsPerItem - never a factor the
 * caller sends, since a forged factor would multiply straight into the
 * stock ledger.
 *
 * The purchase is created through the existing createPurchase() with a clientId
 * derived from the list id. Purchase already has @@unique([shopId, clientId])
 * and returns the existing row for a repeated clientId, so a double tap or a
 * replayed request cannot stock the same goods twice - the database decides,
 * not this function.
 */
export async function receivePurchaseList(
  id: string,
  input: ReceivePurchaseListInput,
  userId: string
) {
  const list = await requireList(id, userId)

  if (list.purchaseId) {
    const existing = await prisma.purchase.findUnique({ where: { id: list.purchaseId } })
    if (existing) return existing
  }
  if (!input.lines?.length) throw new Error('Add at least one item before receiving')

  // The pack factor per product, read from the list's own lines - never from
  // the request body. A missing, zero, or non-finite factor is guarded to 1
  // below so a bad row can never divide by zero or zero out a movement.
  const unitsPerItemByProduct = new Map(
    list.lines.map((line) => [line.product.id, Number(line.unitsPerItem)])
  )

  const purchase = await createPurchase(
    list.shopId,
    {
      supplierId: input.supplierId || list.supplierId || undefined,
      date: input.date,
      reference: input.reference,
      notes: input.notes ?? list.notes ?? undefined,
      onCredit: input.onCredit === true,
      clientId: `plist:${id}`,
      lines: input.lines.map((line) => {
        const stored = unitsPerItemByProduct.get(line.productId)
        const unitsPerItem = stored && Number.isFinite(stored) && stored > 0 ? stored : 1

        return {
          productId: line.productId,
          // Ordering 4 pets of 6 must move the ledger by 24 pieces, not 4.
          quantity: line.quantity * unitsPerItem,
          // The shopkeeper is quoted the price of a pack, so PurchaseLine gets
          // the per-piece cost, not the pack cost.
          unitCost: line.unitCost !== undefined ? line.unitCost / unitsPerItem : undefined,
        }
      }),
    },
    userId
  )

  if (input.images?.length) {
    await prisma.purchaseAttachment.createMany({
      data: input.images.slice(0, 3).map((image) => ({ purchaseId: purchase.id, image })),
    })
  }

  await prisma.purchaseList.update({
    where: { id },
    data: { status: 'RECEIVED', purchaseId: purchase.id },
  })

  return purchase
}
