import { prisma } from '@/lib/db/prisma'
import { Prisma } from '@prisma/client'

/**
 * Bulk catalog import from CSV rows. Loads the product catalog fast for large shops
 * (hardware / sanitary with thousands of SKUs). Stock is NOT set here — add it via
 * purchases / stock-in. Rows are deduped by barcode (existing + within the file).
 */
export interface ImportRow {
  name?: string
  price?: string | number
  unit?: string
  costPrice?: string | number
  tradePrice?: string | number
  cartonPrice?: string | number
  cartonSize?: string | number
  cartonBarcode?: string
  barcode?: string
  sku?: string
  category?: string
  reorderLevel?: string | number
  trackStock?: string | boolean
}

export interface ImportResult {
  created: number
  skipped: number
  errors: Array<{ row: number; name: string; message: string }>
}

const MAX_ROWS = 5000

function toNumber(v: unknown): number | undefined {
  if (v === undefined || v === null || v === '') return undefined
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, '').trim())
  return Number.isFinite(n) ? n : NaN
}

function toInt(v: unknown): number | undefined {
  const n = toNumber(v)
  if (n === undefined) return undefined
  if (Number.isNaN(n)) return NaN
  return Math.trunc(n)
}

function toBool(v: unknown, fallback: boolean): boolean {
  if (v === undefined || v === null || v === '') return fallback
  const s = String(v).trim().toLowerCase()
  if (['yes', 'true', '1', 'y'].includes(s)) return true
  if (['no', 'false', '0', 'n'].includes(s)) return false
  return fallback
}

async function canManage(userId: string, shopId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { shops: { where: { shopId } } },
  })
  if (!user) return false
  if (user.role === 'PLATFORM_ADMIN') return true
  return user.shops.some((us) => us.shopRole === 'STORE_MANAGER')
}

export async function importProducts(
  shopId: string,
  rows: ImportRow[],
  userId: string
): Promise<ImportResult> {
  if (!(await canManage(userId, shopId))) {
    throw new Error('You do not have permission to import products in this shop')
  }
  if (!Array.isArray(rows) || rows.length === 0) throw new Error('No rows to import')
  if (rows.length > MAX_ROWS) throw new Error(`Too many rows (max ${MAX_ROWS} per import)`)

  // Prefetch existing barcodes/SKUs once for dedup.
  const existing = await prisma.product.findMany({
    where: { shopId },
    select: { barcode: true, sku: true },
  })
  const usedBarcodes = new Set(existing.map((e) => e.barcode).filter(Boolean) as string[])
  const usedSkus = new Set(existing.map((e) => e.sku).filter(Boolean) as string[])

  const errors: ImportResult['errors'] = []
  const toCreate: Prisma.ProductCreateManyInput[] = []
  const skuBase = Date.now().toString(36).toUpperCase()

  rows.forEach((raw, i) => {
    const rowNum = i + 1
    const name = String(raw.name ?? '').trim()
    if (!name) {
      errors.push({ row: rowNum, name: '', message: 'Missing name' })
      return
    }

    const price = toNumber(raw.price)
    if (price === undefined || Number.isNaN(price) || price <= 0 || price >= 100000000) {
      errors.push({ row: rowNum, name, message: 'Invalid or missing price' })
      return
    }

    const optPrice = (label: string, v: unknown): number | null | 'err' => {
      const n = toNumber(v)
      if (n === undefined) return null
      if (Number.isNaN(n) || n <= 0 || n >= 100000000) return 'err'
      return n
    }
    const costPrice = optPrice('cost', raw.costPrice)
    const tradePrice = optPrice('trade', raw.tradePrice)
    const cartonPrice = optPrice('carton', raw.cartonPrice)
    if (costPrice === 'err' || tradePrice === 'err' || cartonPrice === 'err') {
      errors.push({ row: rowNum, name, message: 'Invalid cost / trade / carton price' })
      return
    }

    const cartonSize = toInt(raw.cartonSize)
    const reorderLevel = toInt(raw.reorderLevel)
    if (Number.isNaN(cartonSize) || Number.isNaN(reorderLevel)) {
      errors.push({ row: rowNum, name, message: 'Invalid carton size / reorder level' })
      return
    }

    const barcode = String(raw.barcode ?? '').trim() || null
    if (barcode) {
      if (usedBarcodes.has(barcode)) {
        errors.push({ row: rowNum, name, message: `Duplicate barcode ${barcode} (skipped)` })
        return
      }
      usedBarcodes.add(barcode)
    }

    // SKU: use provided (deduped), else generate one unique within shop + batch.
    let sku = String(raw.sku ?? '').trim()
    if (sku && usedSkus.has(sku)) sku = '' // fall through to generated
    if (!sku) {
      sku = `SKU-${skuBase}-${rowNum}`
      let bump = 0
      while (usedSkus.has(sku)) sku = `SKU-${skuBase}-${rowNum}-${++bump}`
    }
    usedSkus.add(sku)

    toCreate.push({
      shopId,
      name: name.toUpperCase(),
      sku,
      barcode,
      unit: String(raw.unit ?? '').trim() || 'pcs',
      price: new Prisma.Decimal(price),
      tradePrice: tradePrice != null ? new Prisma.Decimal(tradePrice) : null,
      costPrice: costPrice != null ? new Prisma.Decimal(costPrice) : null,
      cartonPrice: cartonPrice != null ? new Prisma.Decimal(cartonPrice) : null,
      cartonSize: cartonSize || null,
      cartonBarcode: String(raw.cartonBarcode ?? '').trim() || null,
      category: String(raw.category ?? '').trim() || null,
      reorderLevel: reorderLevel || null,
      trackStock: toBool(raw.trackStock, true),
    })
  })

  let created = 0
  if (toCreate.length > 0) {
    // Insert in chunks; skipDuplicates guards the unique [shopId, barcode] index.
    const CHUNK = 500
    for (let i = 0; i < toCreate.length; i += CHUNK) {
      const res = await prisma.product.createMany({
        data: toCreate.slice(i, i + CHUNK),
        skipDuplicates: true,
      })
      created += res.count
    }
  }

  return { created, skipped: errors.length, errors }
}
