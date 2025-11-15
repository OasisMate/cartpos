import { prisma } from '@/lib/db/prisma'
import { Decimal } from '@prisma/client/runtime/library'
import { getProductStock } from './purchases'

export interface SaleItemInput {
  productId: string
  quantity: number
  unitPrice: number
  lineTotal: number
}

export interface CreateSaleInput {
  customerId?: string
  items: SaleItemInput[]
  subtotal: number
  discount: number
  total: number
  paymentStatus: 'PAID' | 'UDHAAR'
  paymentMethod?: 'CASH' | 'CARD' | 'OTHER'
  amountReceived?: number // For paid sales
}

// Check if user has permission to create sales in a shop
async function checkSalePermission(userId: string, shopId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      shops: {
        where: { shopId },
      },
    },
  })

  if (!user) return false

  // ADMIN can access any shop
  if (user.role === 'ADMIN') return true

  // OWNER and CASHIER can create sales
  const userShop = user.shops.find((us) => us.shopId === shopId)
  return userShop?.shopRole === 'OWNER' || userShop?.shopRole === 'CASHIER'
}

export async function createSale(
  shopId: string,
  input: CreateSaleInput,
  userId: string
) {
  // Check permission
  const hasPermission = await checkSalePermission(userId, shopId)
  if (!hasPermission) {
    throw new Error('You do not have permission to create sales in this shop')
  }

  // Validate items
  if (!input.items || input.items.length === 0) {
    throw new Error('Sale must have at least one item')
  }

  // Validate customer if provided (for udhaar)
  if (input.customerId) {
    const customer = await prisma.customer.findUnique({
      where: { id: input.customerId },
    })

    if (!customer || customer.shopId !== shopId) {
      throw new Error('Invalid customer')
    }
  }

  // For udhaar, customer is required
  if (input.paymentStatus === 'UDHAAR' && !input.customerId) {
    throw new Error('Customer is required for udhaar sales')
  }

  // For paid sales, payment method is required
  if (input.paymentStatus === 'PAID' && !input.paymentMethod) {
    throw new Error('Payment method is required for paid sales')
  }

  // Validate all products exist and belong to shop
  const productIds = input.items.map((item) => item.productId)
  const products = await prisma.product.findMany({
    where: {
      id: { in: productIds },
      shopId,
    },
  })

  if (products.length !== productIds.length) {
    throw new Error('One or more products not found or do not belong to this shop')
  }

  // Validate quantities and check stock for products that track stock
  for (const item of input.items) {
    if (!item.quantity || item.quantity <= 0) {
      throw new Error('All items must have a quantity greater than 0')
    }

    const product = products.find((p) => p.id === item.productId)!
    if (product.trackStock) {
      const currentStock = await getProductStock(shopId, item.productId)
      if (currentStock < item.quantity) {
        throw new Error(`Insufficient stock for ${product.name}. Available: ${currentStock}`)
      }
    }
  }

  // Validate totals (basic validation)
  const calculatedSubtotal = input.items.reduce(
    (sum, item) => sum + item.lineTotal,
    0
  )
  const calculatedTotal = calculatedSubtotal - input.discount

  if (Math.abs(calculatedTotal - input.total) > 0.01) {
    throw new Error('Total calculation mismatch')
  }

  // Create sale (invoice) and lines in a transaction
  const invoice = await prisma.$transaction(async (tx) => {
    // Create invoice header
    const invoice = await tx.invoice.create({
      data: {
        shopId,
        customerId: input.customerId || null,
        paymentStatus: input.paymentStatus,
        paymentMethod:
          input.paymentStatus === 'PAID' ? input.paymentMethod! : null,
        subtotal: new Decimal(input.subtotal),
        discount: new Decimal(input.discount),
        total: new Decimal(input.total),
        createdByUserId: userId,
      },
    })

    // Create invoice lines and stock ledger entries
    for (const itemInput of input.items) {
      const product = products.find((p) => p.id === itemInput.productId)!
      const quantity = new Decimal(itemInput.quantity)
      const unitPrice = new Decimal(itemInput.unitPrice)
      const lineTotal = new Decimal(itemInput.lineTotal)

      // Create invoice line
      const invoiceLine = await tx.invoiceLine.create({
        data: {
          invoiceId: invoice.id,
          productId: itemInput.productId,
          quantity,
          unitPrice,
          lineTotal,
        },
      })

      // Create stock ledger entry (SALE type, negative changeQty)
      await tx.stockLedger.create({
        data: {
          shopId,
          productId: itemInput.productId,
          changeQty: quantity.mul(-1), // Negative for sales
          type: 'SALE',
          refType: 'invoice_line',
          refId: invoiceLine.id,
        },
      })
    }

    // Handle payment or udhaar
    if (input.paymentStatus === 'PAID') {
      // Create payment row
      await tx.payment.create({
        data: {
          shopId,
          invoiceId: invoice.id,
          amount: new Decimal(input.total),
          method: input.paymentMethod!,
          note: input.amountReceived
            ? `Received: ${input.amountReceived}, Change: ${input.amountReceived - input.total}`
            : null,
        },
      })
    } else if (input.paymentStatus === 'UDHAAR' && input.customerId) {
      // Create customer ledger entry (DEBIT - customer owes more)
      await tx.customerLedger.create({
        data: {
          shopId,
          customerId: input.customerId,
          type: 'SALE_UDHAAR',
          direction: 'DEBIT',
          amount: new Decimal(input.total),
          refType: 'invoice',
          refId: invoice.id,
        },
      })
    }

    // Return invoice with lines
    return await tx.invoice.findUnique({
      where: { id: invoice.id },
      include: {
        lines: {
          include: {
            product: true,
          },
        },
        customer: true,
        payments: true,
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })
  })

  return invoice!
}

export async function listSales(shopId: string, filters: {
  customerId?: string
  startDate?: Date
  endDate?: Date
  paymentStatus?: 'PAID' | 'UDHAAR'
  page?: number
  limit?: number
} = {}) {
  const page = filters.page || 1
  const limit = filters.limit || 50
  const skip = (page - 1) * limit

  const where: any = {
    shopId,
  }

  if (filters.customerId) {
    where.customerId = filters.customerId
  }

  if (filters.paymentStatus) {
    where.paymentStatus = filters.paymentStatus
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

  const [invoices, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        customer: true,
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
        payments: true,
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
    prisma.invoice.count({ where }),
  ])

  return {
    sales: invoices,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  }
}