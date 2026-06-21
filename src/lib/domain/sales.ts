import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { Decimal } from '@prisma/client/runtime/library'
import { getProductStock, getProductStockBatch } from './purchases'
import { formatNumber } from '@/lib/utils/money'
import { readFeatureConfig } from './business-presets'
import { getOpenShiftId } from './shifts'
import { shopDayStartUTC, DEFAULT_TIMEZONE } from '@/lib/utils/timezone'

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
  /**
   * Base units per sold item (the packaging factor). 1 for a base-unit sale, `cartonSize`
   * for a carton, or a PackagingLevel factor for box/carton selling. Stock deducts
   * quantity * unitsPerItem so packs draw down the right number of base units, while the
   * invoice line keeps the pack quantity + per-pack price for display.
   */
  unitsPerItem?: number
  /** Packaging label the item was sold as (e.g. "Carton", "Box"); omitted for base-unit sales. */
  packName?: string
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

// Base units a sold item draws from stock (1 for loose; cartonSize / level factor for packs).
function unitsPerItemOf(item: SaleItemInput): number {
  return Number.isFinite(item.unitsPerItem) && (item.unitsPerItem as number) > 0
    ? (item.unitsPerItem as number)
    : 1
}

type SaleProducts = Awaited<ReturnType<typeof prisma.product.findMany>>
type SaleShopSettings = Awaited<ReturnType<typeof prisma.shopSettings.findUnique>>

interface SaleComputation {
  products: SaleProducts
  shopSettings: SaleShopSettings
  batchExpiryOn: boolean
  serviceCharge: number
  deliveryCharge: number
  stockWarnings: Array<{ productName: string; available: number; requested: number }>
}

/**
 * Shared validation + totals for creating/updating a sale. Reads products, shop settings
 * and current stock; throws on any invalid input; returns the bits the writers need.
 * `priorBaseUnitsByProduct` credits stock back (used by edit: the old sale is reversed,
 * so its base units are available again) when enforcing the no-negative-stock policy.
 */
async function validateSaleInput(
  shopId: string,
  input: CreateSaleInput,
  priorBaseUnitsByProduct?: Map<string, number>,
): Promise<SaleComputation> {
  if (!input.items || input.items.length === 0) {
    throw new Error('Sale must have at least one item')
  }

  // Validate customer if provided (for udhaar)
  if (input.customerId) {
    const customer = await prisma.customer.findUnique({ where: { id: input.customerId } })
    if (!customer || customer.shopId !== shopId) {
      throw new Error('Invalid customer')
    }
  }
  if (input.paymentStatus === 'UDHAAR' && !input.customerId) {
    throw new Error('Customer is required for udhaar sales')
  }
  if (input.paymentStatus === 'PAID' && !input.paymentMethod) {
    throw new Error('Payment method is required for paid sales')
  }

  // Validate all products exist and belong to shop
  const productIds = input.items.map((item) => item.productId)
  const products = await prisma.product.findMany({ where: { id: { in: productIds }, shopId } })
  if (products.length !== new Set(productIds).size) {
    throw new Error('One or more products not found or do not belong to this shop')
  }

  const shopSettings = await prisma.shopSettings.findUnique({ where: { shopId } })
  const allowNegativeStock = shopSettings?.allowNegativeStock ?? true // Default: allow
  const batchExpiryOn = readFeatureConfig(shopSettings?.featureConfig).batchExpiry === true

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
  const productIdsToCheck = products.filter((p) => p.trackStock).map((p) => p.id)
  const stockMap = productIdsToCheck.length > 0
    ? await getProductStockBatch(shopId, productIdsToCheck)
    : new Map<string, number>()

  // Requested base units per product (multiple lines can target the same product).
  const requestedByProduct = new Map<string, number>()
  for (const item of input.items) {
    requestedByProduct.set(
      item.productId,
      (requestedByProduct.get(item.productId) || 0) + item.quantity * unitsPerItemOf(item),
    )
  }

  const stockWarnings: SaleComputation['stockWarnings'] = []
  for (const product of products) {
    if (!product.trackStock) continue
    const requested = requestedByProduct.get(product.id) || 0
    if (requested <= 0) continue
    const available = (stockMap.get(product.id) || 0) + (priorBaseUnitsByProduct?.get(product.id) || 0)
    if (available < requested) {
      if (!allowNegativeStock) {
        throw new Error(
          `Insufficient stock for ${product.name}. Available: ${formatNumber(available)} ${product.unit}, Requested: ${formatNumber(requested)} ${product.unit}. Negative stock is not allowed for this shop.`
        )
      }
      stockWarnings.push({ productName: product.name, available, requested })
    }
  }

  // Validate totals. The client's `total` INCLUDES service/delivery charges and the
  // card fee for PAID+CARD sales. Order of charges:
  //   base = subtotal - discount + service + delivery -> preCardTotal; + card fee -> total
  const calculatedSubtotal = input.items.reduce((sum, item) => sum + item.lineTotal, 0)
  const baseTotal = calculatedSubtotal - input.discount
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
      const impliedFee = input.total - preCardTotal
      if (impliedFee < -0.01 || impliedFee > preCardTotal + 0.01) {
        throw new Error('Total calculation mismatch')
      }
      expectedTotal = input.total
    } else {
      const fee = Math.round(preCardTotal * shopPct) / 100
      expectedTotal = preCardTotal + fee
    }
  }
  if (Math.abs(expectedTotal - input.total) > 0.01) {
    throw new Error('Total calculation mismatch')
  }

  return { products, shopSettings, batchExpiryOn, serviceCharge, deliveryCharge, stockWarnings }
}

/**
 * Write the lines, stock ledger, FEFO lot draws, and payment/udhaar ledger for a sale
 * onto an already-existing invoice header. Shared by createSale and updateSale so both
 * post identical side-effects.
 */
async function applySaleEffects(
  tx: Prisma.TransactionClient,
  params: {
    invoiceId: string
    shopId: string
    input: CreateSaleInput
    userId: string
    products: SaleProducts
    batchExpiryOn: boolean
  },
) {
  const { invoiceId, shopId, input, userId, products, batchExpiryOn } = params

  await tx.invoiceLine.createMany({
    data: input.items.map((itemInput) => ({
      invoiceId,
      productId: itemInput.productId,
      quantity: new Decimal(itemInput.quantity),
      unitPrice: new Decimal(itemInput.unitPrice),
      lineTotal: new Decimal(itemInput.lineTotal),
      unitsPerItem: new Decimal(unitsPerItemOf(itemInput)),
      packName: itemInput.packName || null,
    })),
  })

  // Map productId -> line id for stock ledger references.
  const invoiceLines = await tx.invoiceLine.findMany({
    where: { invoiceId },
    select: { id: true, productId: true },
  })
  const invoiceLineMap = new Map(invoiceLines.map((line) => [line.productId, line]))

  await tx.stockLedger.createMany({
    data: input.items.map((itemInput) => {
      const invoiceLine = invoiceLineMap.get(itemInput.productId)
      if (!invoiceLine) {
        throw new Error(`Invoice line not found for product ${itemInput.productId}`)
      }
      return {
        shopId,
        productId: itemInput.productId,
        changeQty: new Decimal(itemInput.quantity).mul(unitsPerItemOf(itemInput)).mul(-1), // base units, negative for sale
        type: 'SALE' as const,
        refType: 'invoice_line',
        refId: invoiceLine.id,
      }
    }),
  })

  // FEFO: batch/expiry shops draw the sold base units from lots, earliest expiry first.
  if (batchExpiryOn) {
    for (const itemInput of input.items) {
      const product = products.find((p) => p.id === itemInput.productId)
      if (!product?.trackStock) continue
      let remaining = itemInput.quantity * unitsPerItemOf(itemInput)
      if (remaining <= 0) continue
      const lots = await tx.stockLot.findMany({
        where: { shopId, productId: itemInput.productId, quantity: { gt: 0 } },
        orderBy: [{ expiry: { sort: 'asc', nulls: 'last' } }, { receivedAt: 'asc' }],
      })
      for (const lot of lots) {
        if (remaining <= 0.0001) break
        const have = Number(lot.quantity)
        const take = Math.min(have, remaining)
        await tx.stockLot.update({ where: { id: lot.id }, data: { quantity: new Decimal(have - take) } })
        remaining -= take
      }
    }
  }

  // Payment (attributed to the cashier's open drawer, if any) or udhaar ledger entry.
  if (input.paymentStatus === 'PAID') {
    const shiftId = await getOpenShiftId(tx, shopId, userId)
    await tx.payment.create({
      data: {
        shopId,
        invoiceId,
        amount: new Decimal(input.total),
        method: input.paymentMethod!,
        receivedById: userId,
        shiftId,
        note: input.amountReceived
          ? `Received: ${input.amountReceived}, Change: ${input.amountReceived - input.total}`
          : null,
      },
    })
  } else if (input.paymentStatus === 'UDHAAR' && input.customerId) {
    await tx.customerLedger.create({
      data: {
        shopId,
        customerId: input.customerId,
        type: 'SALE_UDHAAR',
        direction: 'DEBIT',
        amount: new Decimal(input.total),
        refType: 'invoice',
        refId: invoiceId,
      },
    })
  }
}

export async function createSale(
  shopId: string,
  input: CreateSaleInput,
  userId: string
) {
  const hasPermission = await checkSalePermission(userId, shopId)
  if (!hasPermission) {
    throw new Error('You do not have permission to create sales in this shop')
  }

  const comp = await validateSaleInput(shopId, input)

  // Idempotent lookup runs inside the transaction below (avoids an extra round-trip on every new sale)
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
        if (!isNaN(lastNum)) nextNumber = lastNum + 1
      }
      const invoiceNumber = String(nextNumber).padStart(6, '0') // 000001, 000002, ...

      const invoice = await tx.invoice.create({
        data: {
          shopId,
          customerId: input.customerId || null,
          clientSaleId: input.clientSaleId || null,
          number: invoiceNumber,
          paymentStatus: input.paymentStatus,
          paymentMethod: input.paymentStatus === 'PAID' ? input.paymentMethod! : null,
          subtotal: new Decimal(input.subtotal),
          discount: new Decimal(input.discount),
          serviceCharge: new Decimal(comp.serviceCharge),
          deliveryCharge: new Decimal(comp.deliveryCharge),
          total: new Decimal(input.total),
          createdByUserId: userId,
        },
      })

      await applySaleEffects(tx, {
        invoiceId: invoice.id,
        shopId,
        input,
        userId,
        products: comp.products,
        batchExpiryOn: comp.batchExpiryOn,
      })

      const invoiceWithDetails = await tx.invoice.findUnique({
        where: { id: invoice.id },
        include: invoiceDetailInclude,
      })

      return {
        invoice: invoiceWithDetails!,
        stockWarnings: comp.stockWarnings.length > 0 ? comp.stockWarnings : undefined,
        created: true,
      }
    }, {
      maxWait: 10000,
      timeout: 30000,
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

/**
 * Why an invoice cannot be edited in place, or null if it can be. Used both to gate the
 * UI (canEdit flag in listSales) and to enforce the rule in updateSale. The invoice must
 * be loaded with `payments` (incl. shift status) and a `returns` count.
 */
export function invoiceEditBlockReason(
  invoice: {
    status: string
    createdAt: Date
    payments?: Array<{ shift?: { status: string } | null }>
    returns?: Array<unknown>
    _count?: { returns?: number }
  },
  shopSettings: SaleShopSettings,
  now: Date = new Date(),
): string | null {
  if (invoice.status !== 'COMPLETED') return 'Only completed sales can be edited'
  const returnsCount = invoice._count?.returns ?? invoice.returns?.length ?? 0
  if (returnsCount > 0) return 'This sale has returns and cannot be edited'
  if (readFeatureConfig(shopSettings?.featureConfig).batchExpiry === true) {
    return 'Editing is not available for batch/expiry shops. Void and re-ring instead.'
  }
  const dayStart = shopDayStartUTC(shopSettings?.timezone || DEFAULT_TIMEZONE, now)
  if (invoice.createdAt < dayStart) return "Only today's sales can be edited"
  // Cash counted in a closed drawer is locked; editing would change a reconciled shift.
  if (shopSettings?.requireOpenDrawer) {
    const inClosedShift = (invoice.payments || []).some((p) => p.shift?.status === 'CLOSED')
    if (inClosedShift) return 'This sale is in a closed cash drawer. Void and re-ring instead.'
  }
  return null
}

/**
 * Edit an existing sale in place: reverse the old stock/ledger/payment effects and
 * re-apply the new ones in a single transaction, keeping the same invoice id + number.
 */
export async function updateSale(
  shopId: string,
  invoiceId: string,
  input: CreateSaleInput,
  userId: string
) {
  const hasPermission = await checkSalePermission(userId, shopId)
  if (!hasPermission) {
    throw new Error('You do not have permission to edit sales in this shop')
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      lines: { select: { id: true, productId: true, quantity: true, unitsPerItem: true } },
      payments: { include: { shift: { select: { status: true } } } },
      _count: { select: { returns: true } },
    },
  })
  if (!invoice || invoice.shopId !== shopId) {
    throw new Error('Invoice not found')
  }

  const shopSettings = await prisma.shopSettings.findUnique({ where: { shopId } })
  const blocked = invoiceEditBlockReason(invoice, shopSettings)
  if (blocked) throw new Error(blocked)

  // Old base units per product, credited back to availability during validation.
  const priorByProduct = new Map<string, number>()
  for (const l of invoice.lines) {
    priorByProduct.set(
      l.productId,
      (priorByProduct.get(l.productId) || 0) + Number(l.quantity) * Number(l.unitsPerItem),
    )
  }

  const comp = await validateSaleInput(shopId, input, priorByProduct)

  const result = await prisma.$transaction(async (tx) => {
    const oldLineIds = invoice.lines.map((l) => l.id)

    // Reverse old side-effects.
    if (oldLineIds.length > 0) {
      await tx.stockLedger.deleteMany({ where: { refType: 'invoice_line', refId: { in: oldLineIds } } })
    }
    if (invoice.paymentStatus === 'UDHAAR' && invoice.customerId) {
      await tx.customerLedger.deleteMany({ where: { refType: 'invoice', refId: invoice.id } })
    }
    await tx.payment.deleteMany({ where: { invoiceId: invoice.id } })
    await tx.invoiceLine.deleteMany({ where: { invoiceId: invoice.id } })

    // Update the header (keep id, number, createdAt, createdByUserId, clientSaleId).
    await tx.invoice.update({
      where: { id: invoice.id },
      data: {
        customerId: input.customerId || null,
        paymentStatus: input.paymentStatus,
        paymentMethod: input.paymentStatus === 'PAID' ? input.paymentMethod! : null,
        subtotal: new Decimal(input.subtotal),
        discount: new Decimal(input.discount),
        serviceCharge: new Decimal(comp.serviceCharge),
        deliveryCharge: new Decimal(comp.deliveryCharge),
        total: new Decimal(input.total),
      },
    })

    // Re-apply the new lines, stock, and payment/udhaar.
    await applySaleEffects(tx, {
      invoiceId: invoice.id,
      shopId,
      input,
      userId,
      products: comp.products,
      batchExpiryOn: comp.batchExpiryOn,
    })

    const invoiceWithDetails = await tx.invoice.findUnique({
      where: { id: invoice.id },
      include: invoiceDetailInclude,
    })

    return {
      invoice: invoiceWithDetails!,
      stockWarnings: comp.stockWarnings.length > 0 ? comp.stockWarnings : undefined,
    }
  }, {
    maxWait: 10000,
    timeout: 30000,
  })

  return result
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
        payments: { include: { shift: { select: { status: true } } } },
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            lines: true,
            returns: true,
          },
        },
      },
    }),
    prisma.invoice.count({ where }),
  ])

  // Annotate each sale with whether it can be edited in place (drives the Edit button).
  const shopSettings = await prisma.shopSettings.findUnique({ where: { shopId } })
  const now = new Date()
  const sales = invoices.map((inv) => {
    const reason = invoiceEditBlockReason(inv, shopSettings, now)
    return { ...inv, canEdit: reason === null, editBlockReason: reason }
  })

  return {
    sales,
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

    // Reverse stock for each line (add back base units) - batch insert for performance.
    // Stock is tracked in base units, so add back quantity * unitsPerItem (1 for loose sales).
    if (invoice.lines.length > 0) {
      await tx.stockLedger.createMany({
        data: invoice.lines.map(line => ({
          shopId,
          productId: line.productId,
          changeQty: new Decimal(line.quantity).mul(line.unitsPerItem), // positive to add back, base units
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