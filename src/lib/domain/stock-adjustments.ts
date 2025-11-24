import { prisma } from '@/lib/db/prisma'
import { Decimal } from '@prisma/client/runtime/library'
import { getProductStock } from './purchases'

export interface CreateStockAdjustmentInput {
  productId: string
  type: 'ADJUSTMENT' | 'DAMAGE' | 'EXPIRY' | 'RETURN' | 'SELF_USE'
  quantity: number // Positive for additions, negative for reductions
  notes?: string
  date?: Date
}

// Check if user has permission to create stock adjustments
async function checkStockAdjustmentPermission(userId: string, shopId: string): Promise<boolean> {
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

  // STORE_MANAGER can create stock adjustments
  const userShop = user.shops.find((us) => us.shopId === shopId)
  return userShop?.shopRole === 'STORE_MANAGER'
}

export async function createStockAdjustment(
  shopId: string,
  input: CreateStockAdjustmentInput,
  userId: string
) {
  // Check permission
  const hasPermission = await checkStockAdjustmentPermission(userId, shopId)
  if (!hasPermission) {
    throw new Error('You do not have permission to create stock adjustments in this shop')
  }

  // Validate product exists and belongs to shop
  const product = await prisma.product.findUnique({
    where: { id: input.productId },
  })

  if (!product) {
    throw new Error('Product not found')
  }

  if (product.shopId !== shopId) {
    throw new Error('Product does not belong to this shop')
  }

  // Validate quantity
  if (input.quantity === 0) {
    throw new Error('Quantity cannot be zero')
  }

  // Validate product tracks stock
  if (!product.trackStock) {
    throw new Error('Stock adjustments can only be made for products that track stock')
  }

  // Get current stock for reference
  const currentStock = await getProductStock(shopId, input.productId)

  // Create stock ledger entry
  const stockLedger = await prisma.stockLedger.create({
    data: {
      shopId,
      productId: input.productId,
      changeQty: new Decimal(input.quantity),
      type: input.type,
      refType: 'adjustment',
      refId: null,
      createdAt: input.date || new Date(),
    },
  })

  // Calculate new stock
  const newStock = currentStock + input.quantity

  return {
    stockLedger,
    product,
    previousStock: currentStock,
    newStock,
  }
}

export interface StockAdjustmentFilters {
  productId?: string
  type?: 'ADJUSTMENT' | 'DAMAGE' | 'EXPIRY' | 'RETURN' | 'SELF_USE'
  startDate?: Date
  endDate?: Date
  page?: number
  limit?: number
}

export async function listStockAdjustments(shopId: string, filters: StockAdjustmentFilters = {}) {
  const page = filters.page || 1
  const limit = filters.limit || 50
  const skip = (page - 1) * limit

  const where: any = {
    shopId,
    refType: 'adjustment', // Only get manual adjustments
  }

  if (filters.productId) {
    where.productId = filters.productId
  }

  if (filters.type) {
    where.type = filters.type
  }

  if (filters.startDate || filters.endDate) {
    where.createdAt = {}
    if (filters.startDate) {
      where.createdAt.gte = filters.startDate
    }
    if (filters.endDate) {
      where.createdAt.lte = filters.endDate
    }
  }

  const [adjustments, total] = await Promise.all([
    prisma.stockLedger.findMany({
      where,
      include: {
        product: {
          select: {
            id: true,
            name: true,
            unit: true,
            barcode: true,
            sku: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.stockLedger.count({ where }),
  ])

  return {
    adjustments,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  }
}


