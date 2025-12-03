import { prisma } from '@/lib/db/prisma'
import { Decimal } from '@prisma/client/runtime/library'

export interface CreateProductInput {
  name: string
  sku?: string
  barcode?: string
  unit: string
  price: number
  cartonPrice?: number
  costPrice?: number
  trackStock?: boolean
  reorderLevel?: number
  cartonSize?: number
  cartonBarcode?: string
  initialStock?: number
}

export interface UpdateProductInput extends Partial<CreateProductInput> {}

export interface ProductFilters {
  search?: string
  category?: string
  trackStock?: boolean
  page?: number
  limit?: number
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
 * Retries up to 10 times if generated SKU already exists
 */
async function generateUniqueSKU(shopId: string): Promise<string> {
  let attempts = 0
  const maxAttempts = 10

  while (attempts < maxAttempts) {
    const sku = generateRandomSKU()
    
    // Check if SKU already exists in this shop
    const existing = await prisma.product.findFirst({
      where: {
        shopId,
        sku,
      },
    })

    if (!existing) {
      return sku
    }

    attempts++
  }

  // If we couldn't generate a unique SKU after max attempts, use timestamp-based fallback
  const timestamp = Date.now().toString(36).toUpperCase()
  return `SKU-${timestamp}`
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

  // Validate required fields
  if (!input.name || !input.unit || !input.price) {
    throw new Error('Name, unit, and price are required')
  }

  // Validate barcode uniqueness per shop (if provided)
  if (input.barcode) {
    const existing = await prisma.product.findUnique({
      where: {
        shopId_barcode: {
          shopId,
          barcode: input.barcode,
        },
      },
    })

    if (existing) {
      throw new Error('A product with this barcode already exists in this shop')
    }
  }

  // Generate SKU if not provided
  const finalSKU = input.sku?.trim() || await generateUniqueSKU(shopId)

  // Validate SKU uniqueness per shop
  if (finalSKU) {
    const existing = await prisma.product.findFirst({
      where: {
        shopId,
        sku: finalSKU,
      },
    })

    if (existing) {
      throw new Error('A product with this SKU already exists in this shop')
    }
  }

  // Create product in a transaction so we can add initial stock if provided
  const product = await prisma.$transaction(async (tx) => {
    const newProduct = await tx.product.create({
      data: {
        shopId,
        name: input.name,
        sku: finalSKU,
        barcode: input.barcode || null,
        unit: input.unit,
        price: new Decimal(input.price),
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

  // Validate barcode uniqueness (if being updated)
  if (input.barcode && input.barcode !== product.barcode) {
    const existing = await prisma.product.findUnique({
      where: {
        shopId_barcode: {
          shopId: product.shopId,
          barcode: input.barcode,
        },
      },
    })

    if (existing) {
      throw new Error('A product with this barcode already exists in this shop')
    }
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

  // Update product
  const updated = await prisma.product.update({
    where: { id },
    data: {
      ...(input.name && { name: input.name }),
      ...(finalSKU && { sku: finalSKU }),
      ...(input.barcode !== undefined && { barcode: input.barcode || null }),
      ...(input.unit && { unit: input.unit }),
      ...(input.price !== undefined && { price: new Decimal(input.price) }),
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

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { createdAt: 'desc' },
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
    throw new Error('Cannot delete product that has been used in sales. Consider disabling it instead.')
  }

  // Delete product
  await prisma.product.delete({
    where: { id },
  })

  return { success: true }
}

// Get products for POS (lightweight, no pagination)
export async function getProductsForPOS(shopId: string) {
  const products = await prisma.product.findMany({
    where: {
      shopId,
    },
    select: {
      id: true,
      name: true,
      barcode: true,
      unit: true,
      price: true,
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
    cartonPrice: p.cartonPrice ? parseFloat(p.cartonPrice.toString()) : null,
    trackStock: p.trackStock,
    cartonSize: p.cartonSize,
    cartonBarcode: p.cartonBarcode,
  }))
}