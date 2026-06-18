import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { Decimal } from '@prisma/client/runtime/library'
import { getProductStock, getProductStockBatch } from './purchases'
import { formatNumber } from '@/lib/utils/money'

const invoiceDetailInclude = {
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
} satisfies Prisma.InvoiceInclude

export interface SaleItemInput {
  productId: string
  quantity: number
  unitPrice: number
  lineTotal: number
}

export interface CreateSaleInput {
  /** POS offline sale id (cuid); prevents duplicate invoices if sync runs twice */
  clientSaleId?: string
  customerId?: string
  items: SaleItemInput[]
  subtotal: number
  discount: number
  /** Restaurant service charge added on top of (subtotal - discount). 0 when not applicable. */
  serviceCharge?: number
  /** Restaurant delivery fee added on top of (subtotal - discount). 0 when not applicable. */
  deliveryCharge?: number
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

  // PLATFORM_ADMIN can access any shop
  if (user.role === 'PLATFORM_ADMIN') return true

  // STORE_MANAGER and CASHIER can create sales
  const userShop = user.shops.find((us) => us.shopId === shopId)
  return userShop?.shopRole === 'STORE_MANAGER' || userShop?.shopRole === 'CASHIER'
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

  // Idempotent lookup runs inside the transaction below (avoids an extra round-trip on every new sale)

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

  // Get shop settings to check negative stock policy
  const shopSettings = await prisma.shopSettings.findUnique({
    where: { shopId },
  })

  const allowNegativeStock = shopSettings?.allowNegativeStock ?? true // Default: allow

  // Validate quantities and line amounts (reject NaN/Infinity/negative; verify line math)
  for (const item of input.items) {
    if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
      throw new Error('All items must have a quantity greater than 0')
    }
    if (!Number.isFinite(item.unitPrice) || item.unitPrice < 0 || !Number.isFinite(item.lineTotal) || item.lineTotal < 0) {
      throw new Error('Invalid item price or line total')
    }
    if (Math.abs(item.lineTotal - item.quantity * item.unitPrice) > 0.01) {
      throw new Error('Line total does not match quantity × unit price')
    }
  }
  if (!Number.isFinite(input.subtotal) || !Number.isFinite(input.discount) || !Number.isFinite(input.total) || input.discount < 0) {
    throw new Error('Invalid sale totals')
  }

  // Batch stock check for all products that track stock
  const productsThatTrackStock = products.filter(p => p.trackStock)
  const productIdsToCheck = productsThatTrackStock.map(p => p.id)
  const stockMap = productIdsToCheck.length > 0 
    ? await getProductStockBatch(shopId, productIdsToCheck)
    : new Map<string, number>()
  
  const stockWarnings: Array<{ productName: string; available: number; requested: number }> = []
  
  for (const item of input.items) {
    const product = products.find((p) => p.id === item.productId)!
    if (product.trackStock) {
      const currentStock = stockMap.get(item.productId) || 0
      if (currentStock < item.quantity) {
        // If negative stock not allowed, block the sale
        if (!allowNegativeStock) {
          throw new Error(
            `Insufficient stock for ${product.name}. Available: ${formatNumber(currentStock)} ${product.unit}, Requested: ${formatNumber(item.quantity)} ${product.unit}. Negative stock is not allowed for this shop.`
          )
        }
        // If allowed, collect warning but proceed
        stockWarnings.push({
          productName: product.name,
          available: currentStock,
          requested: item.quantity,
        })
      }
    }
  }

  // If there are stock warnings and negative stock is allowed, we'll include them in the response
  // but still proceed with the sale

  // Validate totals. The client's `total` INCLUDES service/delivery charges and the
  // card fee for PAID+CARD sales, so we must account for them here or sales get
  // wrongly rejected (card fee was bug C8). Order of charges:
  //   base = subtotal - discount
  //   + service charge + delivery charge  -> preCardTotal
  //   + card fee (on preCardTotal)         -> total
  const calculatedSubtotal = input.items.reduce(
    (sum, item) => sum + item.lineTotal,
    0
  )
  const baseTotal = calculatedSubtotal - input.discount

  // Extra charges are client-provided (cashier may edit them per sale). They must be
  // non-negative; their consistency with `total` is enforced by the check below.
  const serviceCharge = Number(input.serviceCharge ?? 0)
  const deliveryCharge = Number(input.deliveryCharge ?? 0)
  if (!Number.isFinite(serviceCharge) || serviceCharge < 0 || !Number.isFinite(deliveryCharge) || deliveryCharge < 0) {
    throw new Error('Invalid service or delivery charge')
  }

  const preCardTotal = baseTotal + serviceCharge + deliveryCharge

  let expectedTotal = preCardTotal
  if (input.paymentStatus === 'PAID' && input.paymentMethod === 'CARD') {
    const shopPct = Number(shopSettings?.cardFeePercent ?? 0)
    const allowOverride = shopSettings?.allowCardFeeOverride ?? false
    if (allowOverride) {
      // Per-sale override is enabled: trust the client's fee but bound it to a sane
      // range (0 .. 100% of the pre-card total) so it can't be abused.
      const impliedFee = input.total - preCardTotal
      if (impliedFee < -0.01 || impliedFee > preCardTotal + 0.01) {
        throw new Error('Total calculation mismatch')
      }
      expectedTotal = input.total
    } else {
      // Recompute the fee from the shop's configured percent (source of truth).
      const fee = Math.round(preCardTotal * shopPct) / 100
      expectedTotal = preCardTotal + fee
    }
  }

  if (Math.abs(expectedTotal - input.total) > 0.01) {
    throw new Error('Total calculation mismatch')
  }

  // Create sale (invoice) and lines in a transaction
  try {
    const invoice = await prisma.$transaction(async (tx) => {
    if (input.clientSaleId) {
      const existing = await tx.invoice.findFirst({
        where: { shopId, clientSaleId: input.clientSaleId },
        include: invoiceDetailInclude,
      })
      if (existing) {
        return { invoice: existing, stockWarnings: undefined, created: false }
      }
    }

    // Generate sequential invoice number for this shop
    const lastInvoice = await tx.invoice.findFirst({
      where: { shopId },
      orderBy: { createdAt: 'desc' },
      select: { number: true },
    })
    
    let nextNumber = 1
    if (lastInvoice?.number) {
      const lastNum = parseInt(lastInvoice.number, 10)
      if (!isNaN(lastNum)) {
        nextNumber = lastNum + 1
      }
    }
    const invoiceNumber = String(nextNumber).padStart(6, '0') // Format: 000001, 000002, etc.

    // Create invoice header
    const invoice = await tx.invoice.create({
      data: {
        shopId,
        customerId: input.customerId || null,
        clientSaleId: input.clientSaleId || null,
        number: invoiceNumber,
        paymentStatus: input.paymentStatus,
        paymentMethod:
          input.paymentStatus === 'PAID' ? input.paymentMethod! : null,
        subtotal: new Decimal(input.subtotal),
        discount: new Decimal(input.discount),
        serviceCharge: new Decimal(serviceCharge),
        deliveryCharge: new Decimal(deliveryCharge),
        total: new Decimal(input.total),
        createdByUserId: userId,
      },
    })

    // Create invoice lines in batch
    await tx.invoiceLine.createMany({
      data: input.items.map(itemInput => ({
        invoiceId: invoice.id,
        productId: itemInput.productId,
        quantity: new Decimal(itemInput.quantity),
        unitPrice: new Decimal(itemInput.unitPrice),
        lineTotal: new Decimal(itemInput.lineTotal),
      })),
    })

    // Query back invoice lines to get their IDs for stock ledger references
    const invoiceLines = await tx.invoiceLine.findMany({
      where: { invoiceId: invoice.id },
      select: { id: true, productId: true, quantity: true },
    })

    // Create a map of productId to invoice line for reliable matching
    const invoiceLineMap = new Map(invoiceLines.map(line => [line.productId, line]))

    // Create stock ledger entries in batch
    await tx.stockLedger.createMany({
      data: input.items.map(itemInput => {
        const invoiceLine = invoiceLineMap.get(itemInput.productId)
        if (!invoiceLine) {
          throw new Error(`Invoice line not found for product ${itemInput.productId}`)
        }
        return {
          shopId,
          productId: itemInput.productId,
          changeQty: new Decimal(itemInput.quantity).mul(-1), // Negative for sales
          type: 'SALE' as const,
          refType: 'invoice_line',
          refId: invoiceLine.id,
        }
      }),
    })

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
    const invoiceWithDetails = await tx.invoice.findUnique({
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

    return {
      invoice: invoiceWithDetails!,
      stockWarnings: stockWarnings.length > 0 ? stockWarnings : undefined,
      created: true,
    }
  }, {
    maxWait: 10000, // 10 seconds max wait
    timeout: 30000, // 30 seconds timeout
  })

    return invoice
  } catch (e) {
    if (
      input.clientSaleId &&
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === 'P2002'
    ) {
      const existing = await prisma.invoice.findFirst({
        where: { shopId, clientSaleId: input.clientSaleId },
        include: invoiceDetailInclude,
      })
      if (existing) {
        return { invoice: existing, stockWarnings: undefined, created: false }
      }
    }
    throw e
  }
}

export async function listSales(shopId: string, filters: {
  customerId?: string
  startDate?: Date
  endDate?: Date
  paymentStatus?: 'PAID' | 'UDHAAR'
  search?: string
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

  // Free-text search by invoice number or customer name.
  if (filters.search) {
    const term = filters.search.trim()
    if (term) {
      where.OR = [
        { number: { contains: term } },
        { customer: { name: { contains: term, mode: 'insensitive' } } },
      ]
    }
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

export async function voidSale(shopId: string, invoiceId: string, userId: string) {
  // Check permission (OWNER or CASHIER; ADMIN also allowed)
  const hasPermission = await checkSalePermission(userId, shopId)
  if (!hasPermission) {
    throw new Error('You do not have permission to void sales in this shop')
  }

  // Load invoice with lines and related info
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      lines: true,
      payments: true,
      customer: true,
    },
  })

  if (!invoice || invoice.shopId !== shopId) {
    throw new Error('Invoice not found')
  }

  if (invoice.status === 'VOID') {
    return invoice
  }

  // Void in a transaction: mark VOID, reverse stock, add ledger/payment reversals
  const result = await prisma.$transaction(async (tx) => {
    // Mark invoice as VOID
    const updated = await tx.invoice.update({
      where: { id: invoice.id },
      data: { status: 'VOID' },
    })

    // Reverse stock for each line (add back quantities) - batch insert for performance
    if (invoice.lines.length > 0) {
      await tx.stockLedger.createMany({
        data: invoice.lines.map(line => ({
          shopId,
          productId: line.productId,
          changeQty: line.quantity, // positive to add back
          type: 'ADJUSTMENT' as const,
          refType: 'invoice_void' as const,
          refId: invoice.id,
        })),
      })
    }

    // If UDHAAR, reverse customer ledger (CREDIT to cancel previous DEBIT)
    if (invoice.paymentStatus === 'UDHAAR' && invoice.customerId) {
      await tx.customerLedger.create({
        data: {
          shopId,
          customerId: invoice.customerId,
          type: 'ADJUSTMENT',
          direction: 'CREDIT',
          amount: invoice.total,
          refType: 'invoice_void',
          refId: invoice.id,
        },
      })
    }

    // If PAID, create negative payment record to reflect reversal
    if (invoice.paymentStatus === 'PAID') {
      await tx.payment.create({
        data: {
          shopId,
          invoiceId: invoice.id,
          amount: invoice.total.mul(-1),
          method: invoice.paymentMethod || 'CASH',
          note: 'Void sale - reversal',
        },
      })
    }

    return updated
  }, {
    maxWait: 10000,
    timeout: 30000,
  })

  return result
}

export async function deleteSale(shopId: string, invoiceId: string, userId: string) {
  const hasPermission = await checkSalePermission(userId, shopId)
  if (!hasPermission) {
    throw new Error('You do not have permission to delete sales in this shop')
  }

  return await prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        lines: true,
      },
    })

    if (!invoice || invoice.shopId !== shopId) {
      throw new Error('Invoice not found')
    }

    const lineIds = invoice.lines.map((line) => line.id)

    if (lineIds.length) {
      await tx.stockLedger.deleteMany({
        where: {
          refType: 'invoice_line',
          refId: { in: lineIds },
        },
      })
    }

    await tx.stockLedger.deleteMany({
      where: {
        refType: 'invoice_void',
        refId: invoice.id,
      },
    })

    await tx.customerLedger.deleteMany({
      where: {
        refId: invoice.id,
        refType: { in: ['invoice', 'invoice_void'] },
      },
    })

    await tx.payment.deleteMany({
      where: {
        invoiceId: invoice.id,
      },
    })

    await tx.invoiceLine.deleteMany({
      where: {
        invoiceId: invoice.id,
      },
    })

    await tx.invoice.delete({
      where: { id: invoice.id },
    })

    return { id: invoice.id }
  }, {
    maxWait: 10000,
    timeout: 30000,
  })
}