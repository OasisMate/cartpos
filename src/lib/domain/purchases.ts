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

export interface UpdatePurchaseInput {
  supplierId?: string
  date?: Date
  reference?: string
  notes?: string
  lines?: PurchaseLineInput[]
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

  // STORE_MANAGER can manage purchases in their shop
  const userShop = user.shops.find((us) => us.shopId === shopId)
  return userShop?.shopRole === 'STORE_MANAGER'
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

// Get stock for all products in a shop (optimized with single aggregation query)
export async function getShopStock(shopId: string) {
  // Single query to get all stock at once using groupBy
  const stockAggregates = await prisma.stockLedger.groupBy({
    by: ['productId'],
    where: { shopId },
    _sum: { changeQty: true },
  })
  
  const stockMap = new Map(
    stockAggregates.map(s => [s.productId, parseFloat(s._sum.changeQty?.toString() || '0')])
  )
  
  const products = await prisma.product.findMany({
    where: { shopId },
    select: {
      id: true,
      name: true,
      unit: true,
      trackStock: true,
    },
  })
  
  return products.map(p => ({
    productId: p.id,
    productName: p.name,
    unit: p.unit,
    trackStock: p.trackStock,
    stock: stockMap.get(p.id) || 0,
  }))
}

// Batch stock lookup for multiple products (optimized)
export async function getProductStockBatch(
  shopId: string, 
  productIds: string[]
): Promise<Map<string, number>> {
  if (productIds.length === 0) {
    return new Map()
  }
  
  const aggregates = await prisma.stockLedger.groupBy({
    by: ['productId'],
    where: { shopId, productId: { in: productIds } },
    _sum: { changeQty: true },
  })
  
  return new Map(
    aggregates.map(s => [s.productId, parseFloat(s._sum.changeQty?.toString() || '0')])
  )
}

export async function updatePurchase(
  id: string,
  input: UpdatePurchaseInput,
  userId: string
) {
  // Get purchase to find shop
  const purchase = await prisma.purchase.findUnique({
    where: { id },
    include: {
      lines: true,
    },
  })

  if (!purchase) {
    throw new Error('Purchase not found')
  }

  // Check permission
  const hasPermission = await checkPurchasePermission(userId, purchase.shopId)
  if (!hasPermission) {
    throw new Error('You do not have permission to update this purchase')
  }

  // If lines are being updated, we need to reverse old stock and apply new stock
  if (input.lines !== undefined) {
    if (input.lines.length === 0) {
      throw new Error('Purchase must have at least one line item')
    }

    // Validate all products exist and belong to shop
    const productIds = input.lines.map((line) => line.productId)
    const products = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        shopId: purchase.shopId,
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

    // Update in transaction
    return await prisma.$transaction(async (tx) => {
      // Reverse old stock ledger entries (delete them)
      for (const oldLine of purchase.lines) {
        await tx.stockLedger.deleteMany({
          where: {
            refType: 'purchase_line',
            refId: oldLine.id,
          },
        })
      }

      // Delete old purchase lines
      await tx.purchaseLine.deleteMany({
        where: { purchaseId: id },
      })

      // Update purchase header
      const updatedPurchase = await tx.purchase.update({
        where: { id },
        data: {
          ...(input.supplierId !== undefined && { supplierId: input.supplierId || null }),
          ...(input.date !== undefined && { date: input.date }),
          ...(input.reference !== undefined && { reference: input.reference?.trim() || null }),
          ...(input.notes !== undefined && { notes: input.notes?.trim() || null }),
        },
      })

      // Create new purchase lines and stock ledger entries
      if (!input.lines) {
        throw new Error('Purchase lines are required')
      }
      for (const lineInput of input.lines) {
        const product = products.find((p) => p.id === lineInput.productId)!
        const quantity = new Decimal(lineInput.quantity)
        const unitCost = lineInput.unitCost ? new Decimal(lineInput.unitCost) : null

        // Create purchase line
        const purchaseLine = await tx.purchaseLine.create({
          data: {
            purchaseId: id,
            productId: lineInput.productId,
            quantity,
            unitCost,
          },
        })

        // Create stock ledger entry
        await tx.stockLedger.create({
          data: {
            shopId: purchase.shopId,
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

      // Return updated purchase with lines
      return await tx.purchase.findUnique({
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
    })
  } else {
    // Only update header fields
    const updated = await prisma.purchase.update({
      where: { id },
      data: {
        ...(input.supplierId !== undefined && { supplierId: input.supplierId || null }),
        ...(input.date !== undefined && { date: input.date }),
        ...(input.reference !== undefined && { reference: input.reference?.trim() || null }),
        ...(input.notes !== undefined && { notes: input.notes?.trim() || null }),
      },
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

    return updated
  }
}

export async function deletePurchase(id: string, userId: string) {
  // Get purchase to find shop
  const purchase = await prisma.purchase.findUnique({
    where: { id },
    include: {
      lines: true,
    },
  })

  if (!purchase) {
    throw new Error('Purchase not found')
  }

  // Check permission
  const hasPermission = await checkPurchasePermission(userId, purchase.shopId)
  if (!hasPermission) {
    throw new Error('You do not have permission to delete this purchase')
  }

  // Delete in transaction - reverse stock entries first
  await prisma.$transaction(async (tx) => {
    // Delete stock ledger entries for all purchase lines
    for (const line of purchase.lines) {
      await tx.stockLedger.deleteMany({
        where: {
          refType: 'purchase_line',
          refId: line.id,
        },
      })
    }

    // Delete purchase lines
    await tx.purchaseLine.deleteMany({
      where: { purchaseId: id },
    })

    // Delete purchase
    await tx.purchase.delete({
      where: { id },
    })
  })

  return { success: true }
}