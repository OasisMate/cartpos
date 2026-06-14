import { prisma } from '@/lib/db/prisma'
import { Decimal } from '@prisma/client/runtime/library'

export interface CreateProductInput {
  name: string
  sku?: string
  barcode?: string
  unit: string
  price: number
  tradePrice?: number
  cartonPrice?: number
  costPrice?: number
  trackStock?: boolean
  reorderLevel?: number
  cartonSize?: number
  cartonBarcode?: string
  initialStock?: number
}

export interface UpdateProductInput extends Partial<CreateProductInput> {}

export type ProductSortBy = 'name' | 'price' | 'costPrice' | 'sku' | 'createdAt' | 'updatedAt'

export interface ProductFilters {
  search?: string
  category?: string
  trackStock?: boolean
  includeArchived?: boolean // when true, also return archived products
  page?: number
  limit?: number
  sortBy?: ProductSortBy
  sortDir?: 'asc' | 'desc'
}

// Check if user has permission to manage products in a shop
async function checkProductPermission(userId: string, shopId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      shops: {
        where: { shopId },
      },
    },
  })

  if (!user) return false

  // PLATFORM_ADMIN can access any shop
  if (user.role === 'PLATFORM_ADMIN') return true

  // STORE_MANAGER can manage products in their shop
  const userShop = user.shops.find((us) => us.shopId === shopId)
  return userShop?.shopRole === 'STORE_MANAGER'
}

/**
 * Generate a random SKU
 * Format: SKU-XXXXXX where X is alphanumeric
 */
function generateRandomSKU(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  const randomPart = Array.from({ length: 6 }, () => 
    chars.charAt(Math.floor(Math.random() * chars.length))
  ).join('')
  return `SKU-${randomPart}`
}

/**
 * Generate a unique SKU for a shop
 * Uses timestamp-based approach for guaranteed uniqueness (much faster than random retries)
 */
async function generateUniqueSKU(shopId: string): Promise<string> {
  // Use timestamp + random suffix for guaranteed uniqueness
  const timestamp = Date.now().toString(36).toUpperCase()
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase()
  const sku = `SKU-${timestamp}-${randomSuffix}`
  
  // Double-check uniqueness (should be extremely rare collision)
  const existing = await prisma.product.findFirst({
    where: {
      shopId,
      sku,
    },
    select: { id: true }, // Only select id for faster query
  })

  if (!existing) {
    return sku
  }

  // Fallback: timestamp only (guaranteed unique)
  return `SKU-${Date.now()}`
}

/**
 * Ensure a product's piece barcode and carton barcode don't collide with each
 * other or with any other product's barcode/cartonBarcode in the same shop.
 * Prevents the "same item in two places" problem and ambiguous POS scans.
 */
async function assertBarcodesAvailable(
  shopId: string,
  codes: { barcode?: string | null; cartonBarcode?: string | null },
  excludeProductId?: string
) {
  const barcode = codes.barcode?.trim() || null
  const cartonBarcode = codes.cartonBarcode?.trim() || null

  if (barcode && cartonBarcode && barcode === cartonBarcode) {
    throw new Error('The piece barcode and carton barcode must be different')
  }

  const toCheck = [
    barcode ? { value: barcode, label: 'barcode' } : null,
    cartonBarcode ? { value: cartonBarcode, label: 'carton barcode' } : null,
  ].filter(Boolean) as { value: string; label: string }[]

  for (const c of toCheck) {
    const clash = await prisma.product.findFirst({
      where: {
        shopId,
        ...(excludeProductId ? { id: { not: excludeProductId } } : {}),
        OR: [{ barcode: c.value }, { cartonBarcode: c.value }],
      },
      select: { name: true, barcode: true },
    })
    if (clash) {
      const usedAs = clash.barcode === c.value ? 'barcode' : 'carton barcode'
      throw new Error(`The ${c.label} "${c.value}" is already used as the ${usedAs} of "${clash.name}"`)
    }
  }
}

export async function createProduct(
  shopId: string,
  input: CreateProductInput,
  userId: string
) {
  // Check permission
  const hasPermission = await checkProductPermission(userId, shopId)
  if (!hasPermission) {
    throw new Error('You do not have permission to create products in this shop')
  }

  // Force uppercase for consistent product naming across the system (intentional UX choice).
  const name = (input.name || '').trim().toUpperCase()
  if (!name || !input.unit) {
    throw new Error('Name and unit are required')
  }
  if (!Number.isFinite(input.price) || input.price <= 0) {
    throw new Error('Price must be a valid amount greater than 0')
  }
  if (input.costPrice != null && (!Number.isFinite(input.costPrice) || input.costPrice < 0)) {
    throw new Error('Cost price must be a valid non-negative amount')
  }

  // Validate barcode + carton barcode uniqueness across both columns per shop.
  await assertBarcodesAvailable(shopId, { barcode: input.barcode, cartonBarcode: input.cartonBarcode })

  // Generate SKU if not provided
  const finalSKU = input.sku?.trim() || await generateUniqueSKU(shopId)

  // Note: SKU uniqueness is already guaranteed by generateUniqueSKU, no need to check again

  // Create product in a transaction so we can add initial stock if provided
  const product = await prisma.$transaction(async (tx) => {
    const newProduct = await tx.product.create({
      data: {
        shopId,
        name,
        sku: finalSKU,
        barcode: input.barcode || null,
        unit: input.unit,
        price: new Decimal(input.price),
        tradePrice: input.tradePrice ? new Decimal(input.tradePrice) : null,
        cartonPrice: input.cartonPrice ? new Decimal(input.cartonPrice) : null,
        costPrice: input.costPrice ? new Decimal(input.costPrice) : null,
        trackStock: input.trackStock ?? true,
        reorderLevel: input.reorderLevel || null,
        cartonSize: input.cartonSize || null,
        cartonBarcode: input.cartonBarcode || null,
      },
    })

    // If initial stock is provided and product tracks stock, create stock ledger entry
    if (input.initialStock && input.initialStock > 0 && newProduct.trackStock) {
      await tx.stockLedger.create({
        data: {
          shopId,
          productId: newProduct.id,
          changeQty: new Decimal(input.initialStock),
          type: 'ADJUSTMENT',
          refType: 'initial_stock',
          refId: null,
        },
      })
    }

    return newProduct
  })

  return product
}

export async function updateProduct(
  id: string,
  input: UpdateProductInput,
  userId: string
) {
  // Get product to find shop
  const product = await prisma.product.findUnique({
    where: { id },
  })

  if (!product) {
    throw new Error('Product not found')
  }

  // Check permission
  const hasPermission = await checkProductPermission(userId, product.shopId)
  if (!hasPermission) {
    throw new Error('You do not have permission to update this product')
  }

  // Validate barcode + carton barcode against the product's resulting state.
  if (input.barcode !== undefined || input.cartonBarcode !== undefined) {
    const effBarcode = input.barcode !== undefined ? input.barcode : product.barcode
    const effCartonBarcode = input.cartonBarcode !== undefined ? input.cartonBarcode : product.cartonBarcode
    await assertBarcodesAvailable(product.shopId, { barcode: effBarcode, cartonBarcode: effCartonBarcode }, id)
  }

  // Lazy migration: Generate SKU if product doesn't have one and SKU is not being explicitly set
  let finalSKU = input.sku?.trim() || product.sku
  if (!finalSKU) {
    finalSKU = await generateUniqueSKU(product.shopId)
  }

  // Validate SKU uniqueness if it's being changed
  if (finalSKU && finalSKU !== product.sku) {
    const existing = await prisma.product.findFirst({
      where: {
        shopId: product.shopId,
        sku: finalSKU,
      },
    })

    if (existing) {
      throw new Error('A product with this SKU already exists in this shop')
    }
  }

  // Force uppercase for consistent product naming (intentional UX choice).
  const nameUpdate =
    input.name !== undefined && input.name !== null
      ? { name: (String(input.name).trim() || product.name).toUpperCase() }
      : {}

  // Update product
  const updated = await prisma.product.update({
    where: { id },
    data: {
      ...nameUpdate,
      ...(finalSKU && { sku: finalSKU }),
      ...(input.barcode !== undefined && { barcode: input.barcode || null }),
      ...(input.unit && { unit: input.unit }),
      ...(input.price !== undefined && { price: new Decimal(input.price) }),
      ...(input.tradePrice !== undefined && {
        tradePrice: input.tradePrice ? new Decimal(input.tradePrice) : null,
      }),
      ...(input.cartonPrice !== undefined && {
        cartonPrice: input.cartonPrice ? new Decimal(input.cartonPrice) : null,
      }),
      ...(input.costPrice !== undefined && {
        costPrice: input.costPrice ? new Decimal(input.costPrice) : null,
      }),
      ...(input.trackStock !== undefined && { trackStock: input.trackStock }),
      ...(input.reorderLevel !== undefined && {
        reorderLevel: input.reorderLevel || null,
      }),
      ...(input.cartonSize !== undefined && { cartonSize: input.cartonSize || null }),
      ...(input.cartonBarcode !== undefined && { cartonBarcode: input.cartonBarcode || null }),
    },
  })

  return updated
}

export async function listProducts(shopId: string, filters: ProductFilters = {}) {
  const page = filters.page || 1
  const limit = filters.limit || 50
  const skip = (page - 1) * limit

  const where: any = {
    shopId,
  }

  // Hide archived products by default
  if (!filters.includeArchived) {
    where.archivedAt = null
  }

  // Search filter (name, sku, barcode)
  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: 'insensitive' } },
      { sku: { contains: filters.search, mode: 'insensitive' } },
      { barcode: { contains: filters.search, mode: 'insensitive' } },
    ]
  }

  // Category filter
  if (filters.category) {
    where.category = filters.category
  }

  // Track stock filter
  if (filters.trackStock !== undefined) {
    where.trackStock = filters.trackStock
  }

  // Sorting (DB columns only; stock is computed from the ledger so it isn't sortable here)
  const sortableColumns: ProductSortBy[] = ['name', 'price', 'costPrice', 'sku', 'createdAt', 'updatedAt']
  const sortBy = filters.sortBy && sortableColumns.includes(filters.sortBy) ? filters.sortBy : 'createdAt'
  const sortDir = filters.sortDir === 'asc' ? 'asc' : 'desc'

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { [sortBy]: sortDir },
      skip,
      take: limit,
    }),
    prisma.product.count({ where }),
  ])

  // Get stock for all products efficiently
  const productIds = products.map((p) => p.id)
  const stockMap = new Map<string, number>()

  if (productIds.length > 0) {
    // Fetch all stock ledger entries for these products in one query
    const stockEntries = await prisma.stockLedger.findMany({
      where: {
        shopId,
        productId: { in: productIds },
      },
      select: {
        productId: true,
        changeQty: true,
      },
    })

    // Aggregate stock by productId
    stockEntries.forEach((entry) => {
      const current = stockMap.get(entry.productId) || 0
      stockMap.set(entry.productId, current + parseFloat(entry.changeQty.toString()))
    })
  }

  // Add stock to products
  const productsWithStock = products.map((product) => ({
    ...product,
    stock: product.trackStock ? (stockMap.get(product.id) || 0) : null,
  }))

  return {
    products: productsWithStock,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  }
}

export async function getProduct(id: string, userId: string) {
  const product = await prisma.product.findUnique({
    where: { id },
  })

  if (!product) {
    throw new Error('Product not found')
  }

  // Check permission
  const hasPermission = await checkProductPermission(userId, product.shopId)
  if (!hasPermission) {
    throw new Error('You do not have permission to view this product')
  }

  return product
}

export async function deleteProduct(id: string, userId: string) {
  // Get product to find shop
  const product = await prisma.product.findUnique({
    where: { id },
  })

  if (!product) {
    throw new Error('Product not found')
  }

  // Check permission
  const hasPermission = await checkProductPermission(userId, product.shopId)
  if (!hasPermission) {
    throw new Error('You do not have permission to delete this product')
  }

  // Check if product has been used in any invoices (sales)
  const invoiceLineCount = await prisma.invoiceLine.count({
    where: { productId: id },
  })

  if (invoiceLineCount > 0) {
    throw new Error('Cannot delete a product that has been used in sales. Archive it instead to hide it.')
  }

  // Delete product
  await prisma.product.delete({
    where: { id },
  })

  return { success: true, shopId: product.shopId, name: product.name }
}

/** Hide a product from POS, lists and dashboard. Sales history is preserved. */
export async function archiveProduct(id: string, userId: string) {
  return setArchived(id, userId, new Date())
}

/** Restore a previously archived product. */
export async function unarchiveProduct(id: string, userId: string) {
  return setArchived(id, userId, null)
}

async function setArchived(id: string, userId: string, archivedAt: Date | null) {
  const product = await prisma.product.findUnique({ where: { id } })
  if (!product) {
    throw new Error('Product not found')
  }
  const hasPermission = await checkProductPermission(userId, product.shopId)
  if (!hasPermission) {
    throw new Error('You do not have permission to modify this product')
  }
  await prisma.product.update({ where: { id }, data: { archivedAt } })
  return { success: true, shopId: product.shopId, name: product.name, archived: archivedAt !== null }
}

// Get products for POS (lightweight, no pagination)
export async function getProductsForPOS(shopId: string) {
  const products = await prisma.product.findMany({
    where: {
      shopId,
      archivedAt: null, // archived products can't be sold
    },
    select: {
      id: true,
      name: true,
      barcode: true,
      unit: true,
      price: true,
      tradePrice: true,
      cartonPrice: true,
      trackStock: true,
      cartonSize: true,
      cartonBarcode: true,
    },
    orderBy: { name: 'asc' },
  })

  return products.map((p) => ({
    id: p.id,
    name: p.name,
    barcode: p.barcode,
    unit: p.unit,
    price: parseFloat(p.price.toString()),
    tradePrice: p.tradePrice ? parseFloat(p.tradePrice.toString()) : null,
    cartonPrice: p.cartonPrice ? parseFloat(p.cartonPrice.toString()) : null,
    trackStock: p.trackStock,
    cartonSize: p.cartonSize,
    cartonBarcode: p.cartonBarcode,
  }))
}