import { prisma } from '@/lib/db/prisma'
import { Decimal } from '@prisma/client/runtime/library'

export interface PurchaseLineInput {
  productId: string
  quantity: number
  unitCost?: number
}

export interface CreatePurchaseInput {
  supplierId?: string
  date?: Date
  reference?: string
  notes?: string
  lines: PurchaseLineInput[]
}

export interface PurchaseFilters {
  supplierId?: string
  startDate?: Date
  endDate?: Date
  page?: number
  limit?: number
}

// Check if user has permission to manage purchases in a shop
async function checkPurchasePermission(userId: string, shopId: string): Promise<boolean> {
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

  // SHOP_OWNER can manage purchases in their shop
  const userShop = user.shops.find((us) => us.shopId === shopId)
  return userShop?.shopRole === 'SHOP_OWNER'
}

// Get current stock for a product by summing StockLedger.changeQty
export async function getProductStock(shopId: string, productId: string): Promise<number> {
  const stockLedger = await prisma.stockLedger.findMany({
    where: {
      shopId,
      productId,
    },
    select: {
      changeQty: true,
    },
  })

  const total = stockLedger.reduce((sum, entry) => {
    return sum + parseFloat(entry.changeQty.toString())
  }, 0)

  return total
}

export async function createPurchase(
  shopId: string,
  input: CreatePurchaseInput,
  userId: string
) {
  // Check permission
  const hasPermission = await checkPurchasePermission(userId, shopId)
  if (!hasPermission) {
    throw new Error('You do not have permission to create purchases in this shop')
  }

  // Validate lines
  if (!input.lines || input.lines.length === 0) {
    throw new Error('Purchase must have at least one line item')
  }

  // Validate supplier if provided
  if (input.supplierId) {
    const supplier = await prisma.supplier.findUnique({
      where: { id: input.supplierId },
    })

    if (!supplier || supplier.shopId !== shopId) {
      throw new Error('Invalid supplier')
    }
  }

  // Validate all products exist and belong to shop
  const productIds = input.lines.map((line) => line.productId)
  const products = await prisma.product.findMany({
    where: {
      id: { in: productIds },
      shopId,
    },
  })

  if (products.length !== productIds.length) {
    throw new Error('One or more products not found or do not belong to this shop')
  }

  // Validate quantities
  for (const line of input.lines) {
    if (!line.quantity || line.quantity <= 0) {
      throw new Error('All line items must have a quantity greater than 0')
    }
  }

  // Create purchase and lines in a transaction
  const purchase = await prisma.$transaction(async (tx) => {
    // Create purchase header
    const purchase = await tx.purchase.create({
      data: {
        shopId,
        supplierId: input.supplierId || null,
        date: input.date || new Date(),
        reference: input.reference?.trim() || null,
        notes: input.notes?.trim() || null,
        createdByUserId: userId,
      },
    })

    // Create purchase lines and stock ledger entries
    for (const lineInput of input.lines) {
      const product = products.find((p) => p.id === lineInput.productId)!
      const quantity = new Decimal(lineInput.quantity)
      const unitCost = lineInput.unitCost ? new Decimal(lineInput.unitCost) : null

      // Create purchase line
      const purchaseLine = await tx.purchaseLine.create({
        data: {
          purchaseId: purchase.id,
          productId: lineInput.productId,
          quantity,
          unitCost,
        },
      })

      // Create stock ledger entry (PURCHASE type, positive changeQty)
      await tx.stockLedger.create({
        data: {
          shopId,
          productId: lineInput.productId,
          changeQty: quantity,
          type: 'PURCHASE',
          refType: 'purchase_line',
          refId: purchaseLine.id,
        },
      })

      // Update product costPrice if unitCost provided
      if (unitCost) {
        await tx.product.update({
          where: { id: lineInput.productId },
          data: { costPrice: unitCost },
        })
      }
    }

    // Return purchase with lines
    return await tx.purchase.findUnique({
      where: { id: purchase.id },
      include: {
        lines: {
          include: {
            product: true,
          },
        },
        supplier: true,
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })
  })

  return purchase!
}

export async function listPurchases(shopId: string, filters: PurchaseFilters = {}) {
  const page = filters.page || 1
  const limit = filters.limit || 50
  const skip = (page - 1) * limit

  const where: any = {
    shopId,
  }

  // Supplier filter
  if (filters.supplierId) {
    where.supplierId = filters.supplierId
  }

  // Date range filter
  if (filters.startDate || filters.endDate) {
    where.date = {}
    if (filters.startDate) {
      where.date.gte = filters.startDate
    }
    if (filters.endDate) {
      where.date.lte = filters.endDate
    }
  }

  const [purchases, total] = await Promise.all([
    prisma.purchase.findMany({
      where,
      orderBy: { date: 'desc' },
      skip,
      take: limit,
      include: {
        supplier: true,
        lines: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                unit: true,
              },
            },
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            lines: true,
          },
        },
      },
    }),
    prisma.purchase.count({ where }),
  ])

  return {
    purchases,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  }
}

export async function getPurchase(id: string, userId: string) {
  const purchase = await prisma.purchase.findUnique({
    where: { id },
    include: {
      lines: {
        include: {
          product: true,
        },
      },
      supplier: true,
      createdBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  })

  if (!purchase) {
    throw new Error('Purchase not found')
  }

  // Check permission
  const hasPermission = await checkPurchasePermission(userId, purchase.shopId)
  if (!hasPermission) {
    throw new Error('You do not have permission to view this purchase')
  }

  return purchase
}

// Get stock for all products in a shop (naive approach - sums all StockLedger entries)
export async function getShopStock(shopId: string) {
  const products = await prisma.product.findMany({
    where: { shopId },
    select: {
      id: true,
      name: true,
      unit: true,
      trackStock: true,
    },
  })

  const stock = await Promise.all(
    products.map(async (product) => {
      const currentStock = await getProductStock(shopId, product.id)
      return {
        productId: product.id,
        productName: product.name,
        unit: product.unit,
        trackStock: product.trackStock,
        stock: currentStock,
      }
    })
  )

  return stock
}