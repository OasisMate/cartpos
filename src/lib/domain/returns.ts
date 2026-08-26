import { prisma } from '@/lib/db/prisma'
import { Prisma } from '@prisma/client'
import { getOpenShiftId } from './shifts'

const D = (n: number | string | Prisma.Decimal) => new Prisma.Decimal(n)

/** Returns/refunds move money + stock, so they are manager-level: store manager, org owner, or platform admin (never a plain cashier). */
async function checkManagerPermission(userId: string, shopId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { shops: { where: { shopId } }, organizations: true },
  })
  if (!user) return false
  if (user.role === 'PLATFORM_ADMIN') return true
  if (user.shops.some((s) => s.shopRole === 'STORE_MANAGER')) return true
  const shop = await prisma.shop.findUnique({ where: { id: shopId }, select: { orgId: true } })
  return !!shop && user.organizations.some((o) => o.orgId === shop.orgId && o.orgRole === 'ORG_ADMIN')
}

export interface ReturnableLine {
  /**
   * Identifies the row for the client. A product sold both loose and by the carton on one
   * invoice is two returnable rows at two different prices, so productId alone is not enough
   * to tell them apart.
   */
  lineKey: string
  productId: string
  name: string
  unit: string
  unitPrice: number
  /** Base units per returned item: 1 for loose, cartonSize for a carton. */
  unitsPerItem: number
  /** Packaging label, e.g. "Carton". Null for a base-unit line. */
  packName: string | null
  sold: number
  alreadyReturned: number
  returnable: number
}

/** How a returnable row is identified: same product AND same packaging. */
export function returnLineKey(productId: string, unitsPerItem: number): string {
  return `${productId}::${unitsPerItem}`
}

/** Base units a return line moves: pack count times pack size. */
function baseUnits(quantity: number, unitsPerItem: number): number {
  const per = Number(unitsPerItem)
  return quantity * (Number.isFinite(per) && per > 0 ? per : 1)
}

export interface ReturnableInvoice {
  invoiceId: string
  number: string | null
  createdAt: string
  paymentStatus: string
  customerId: string | null
  customerName: string | null
  lines: ReturnableLine[]
}

/** Load a completed invoice with per-line returnable quantities (sold minus already returned). */
export async function getReturnableInvoice(invoiceId: string, userId: string): Promise<ReturnableInvoice> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      lines: { include: { product: { select: { name: true, unit: true } } } },
      customer: { select: { id: true, name: true } },
    },
  })
  if (!invoice) throw new Error('Invoice not found')

  const allowed = await checkManagerPermission(userId, invoice.shopId)
  if (!allowed) throw new Error('You do not have permission to process returns in this shop')

  if (invoice.status !== 'COMPLETED') throw new Error('Only completed sales can be returned')

  // Prior returns, counted per product AND packaging: returning a carton must not eat into
  // what can still be returned loose.
  const priorLines = await prisma.saleReturnLine.findMany({
    where: { isReplacement: false, saleReturn: { originalInvoiceId: invoiceId } },
    select: { productId: true, quantity: true, unitsPerItem: true },
  })
  const returnedByKey = new Map<string, number>()
  for (const l of priorLines) {
    const key = returnLineKey(l.productId, Number(l.unitsPerItem))
    returnedByKey.set(key, (returnedByKey.get(key) || 0) + Number(l.quantity))
  }

  // Collapse invoice lines by product + packaging. Grouping on product alone merged a loose
  // sale and a carton sale into one row, which then carried whichever price came first and
  // could not restock the right number of units.
  const byProduct = new Map<string, ReturnableLine>()
  for (const line of invoice.lines) {
    const unitsPerItem = Number(line.unitsPerItem) || 1
    const key = returnLineKey(line.productId, unitsPerItem)
    const existing = byProduct.get(key)
    const sold = Number(line.quantity)
    if (existing) {
      existing.sold += sold
    } else {
      byProduct.set(key, {
        lineKey: key,
        productId: line.productId,
        name: line.product.name,
        unit: line.product.unit,
        unitPrice: Number(line.unitPrice),
        unitsPerItem,
        packName: line.packName ?? null,
        sold,
        alreadyReturned: returnedByKey.get(key) || 0,
        returnable: 0,
      })
    }
  }
  const lines = Array.from(byProduct.values()).map((l) => ({
    ...l,
    returnable: Math.max(0, Math.round((l.sold - l.alreadyReturned) * 1000) / 1000),
  }))

  return {
    invoiceId: invoice.id,
    number: invoice.number,
    createdAt: invoice.createdAt.toISOString(),
    paymentStatus: invoice.paymentStatus,
    customerId: invoice.customer?.id ?? null,
    customerName: invoice.customer?.name ?? null,
    lines,
  }
}

export interface CreateReturnInput {
  invoiceId: string
  returnLines: Array<{
    productId: string
    quantity: number
    damaged?: boolean
    /** Packaging the item was sold as. Omitted means loose, which is what older clients send. */
    unitsPerItem?: number
  }>
  replacementLines?: Array<{ productId: string; quantity: number }>
  settlement: 'CASH' | 'ACCOUNT_CREDIT'
  note?: string
}

/**
 * Process a return / refund / exchange against an original sale.
 * - Returned goods go back to stock (or are written off if damaged).
 * - Exchange replacement items leave stock as a new sale-out.
 * - Net (returnValue - replacementValue) is settled by cash or customer account.
 */
export async function createReturn(shopId: string, userId: string, input: CreateReturnInput) {
  const allowed = await checkManagerPermission(userId, shopId)
  if (!allowed) throw new Error('You do not have permission to process returns in this shop')

  const invoice = await prisma.invoice.findUnique({
    where: { id: input.invoiceId },
    include: { lines: true },
  })
  if (!invoice || invoice.shopId !== shopId) throw new Error('Invoice not found')
  if (invoice.status !== 'COMPLETED') throw new Error('Only completed sales can be returned')

  if (!input.returnLines?.length && !input.replacementLines?.length) {
    throw new Error('Nothing to return or exchange')
  }

  // Original sold + already-returned, keyed by product AND packaging (server-trusted prices
  // and quantities). A carton and a loose unit of the same product are separate entitlements
  // at separate prices, so they cannot share a bucket.
  const soldByKey = new Map<string, { qty: number; unitPrice: number; unitsPerItem: number; packName: string | null }>()
  for (const l of invoice.lines) {
    const unitsPerItem = Number(l.unitsPerItem) || 1
    const key = returnLineKey(l.productId, unitsPerItem)
    const e = soldByKey.get(key)
    if (e) e.qty += Number(l.quantity)
    else
      soldByKey.set(key, {
        qty: Number(l.quantity),
        unitPrice: Number(l.unitPrice),
        unitsPerItem,
        packName: l.packName ?? null,
      })
  }
  const prior = await prisma.saleReturnLine.findMany({
    where: { isReplacement: false, saleReturn: { originalInvoiceId: invoice.id } },
    select: { productId: true, quantity: true, unitsPerItem: true },
  })
  const returnedByKey = new Map<string, number>()
  for (const l of prior) {
    const key = returnLineKey(l.productId, Number(l.unitsPerItem))
    returnedByKey.set(key, (returnedByKey.get(key) || 0) + Number(l.quantity))
  }

  // Validate + price the returned lines.
  let returnTotal = 0
  const returnRows = (input.returnLines || []).map((rl) => {
    // An older client sends no packaging. Fall back to the sole packaging this product was sold
    // in, so a loose-only invoice keeps working unchanged; refuse to guess when it was sold in
    // more than one, because picking wrong restocks the wrong number of units.
    let unitsPerItem = Number(rl.unitsPerItem)
    if (!Number.isFinite(unitsPerItem) || unitsPerItem <= 0) {
      const matches = [...soldByKey.entries()].filter(([k]) => k.startsWith(`${rl.productId}::`))
      if (matches.length > 1) {
        throw new Error(
          'This item was sold in more than one pack size; choose which one is being returned'
        )
      }
      unitsPerItem = matches.length === 1 ? matches[0][1].unitsPerItem : 1
    }

    const key = returnLineKey(rl.productId, unitsPerItem)
    const sold = soldByKey.get(key)
    if (!sold) throw new Error('Returned item was not on this invoice')
    const qty = Number(rl.quantity)
    if (!(qty > 0)) throw new Error('Return quantity must be greater than zero')
    const remaining = sold.qty - (returnedByKey.get(key) || 0)
    if (qty > remaining + 1e-6) throw new Error('Return quantity exceeds what was sold')
    const lineTotal = Math.round(qty * sold.unitPrice * 100) / 100
    returnTotal += lineTotal
    return {
      productId: rl.productId,
      quantity: qty,
      unitPrice: sold.unitPrice,
      lineTotal,
      damaged: !!rl.damaged,
      unitsPerItem: sold.unitsPerItem,
      packName: sold.packName,
    }
  })

  // Price the replacement (exchange) lines from current product prices.
  let replacementTotal = 0
  const replRows: Array<{ productId: string; quantity: number; unitPrice: number; lineTotal: number }> = []
  if (input.replacementLines?.length) {
    const ids = input.replacementLines.map((r) => r.productId)
    const products = await prisma.product.findMany({ where: { shopId, id: { in: ids } }, select: { id: true, price: true } })
    const priceById = new Map(products.map((p) => [p.id, Number(p.price)]))
    for (const r of input.replacementLines) {
      const price = priceById.get(r.productId)
      if (price == null) throw new Error('Replacement item not found in this shop')
      const qty = Number(r.quantity)
      if (!(qty > 0)) throw new Error('Replacement quantity must be greater than zero')
      const lineTotal = Math.round(qty * price * 100) / 100
      replacementTotal += lineTotal
      replRows.push({ productId: r.productId, quantity: qty, unitPrice: price, lineTotal })
    }
  }

  returnTotal = Math.round(returnTotal * 100) / 100
  replacementTotal = Math.round(replacementTotal * 100) / 100
  const netRefund = Math.round((returnTotal - replacementTotal) * 100) / 100 // >0 pay customer, <0 collect
  const kind = replRows.length ? 'EXCHANGE' : 'REFUND'

  if (input.settlement === 'ACCOUNT_CREDIT' && !invoice.customerId) {
    throw new Error('Account credit requires a customer on the original sale; use cash instead')
  }

  return prisma.$transaction(async (tx) => {
    const saleReturn = await tx.saleReturn.create({
      data: {
        shopId,
        originalInvoiceId: invoice.id,
        customerId: invoice.customerId,
        kind,
        returnTotal: D(returnTotal),
        replacementTotal: D(replacementTotal),
        netRefund: D(netRefund),
        settlementMethod: input.settlement,
        note: input.note || null,
        createdByUserId: userId,
        lines: {
          create: [
            ...returnRows.map((r) => ({
              productId: r.productId,
              quantity: D(r.quantity),
              unitPrice: D(r.unitPrice),
              lineTotal: D(r.lineTotal),
              isReplacement: false,
              restocked: !r.damaged,
              // Carried so restocking and cost reversal both work in base units.
              unitsPerItem: D(r.unitsPerItem),
              packName: r.packName,
            })),
            ...replRows.map((r) => ({
              productId: r.productId,
              quantity: D(r.quantity),
              unitPrice: D(r.unitPrice),
              lineTotal: D(r.lineTotal),
              isReplacement: true,
              restocked: false,
            })),
          ],
        },
      },
    })

    // Stock: returned goods back in (unless damaged); replacements out.
    // Base units, not pack counts: returning one carton of twelve must put twelve back on the
    // shelf. The stock ledger is denominated in base units throughout.
    const stockRows = [
      ...returnRows
        .filter((r) => !r.damaged)
        .map((r) => ({
          shopId,
          productId: r.productId,
          changeQty: D(baseUnits(r.quantity, r.unitsPerItem)),
          type: 'RETURN' as const,
          refType: 'sale_return',
          refId: saleReturn.id,
        })),
      // Replacements are picked from the product list at its base price, so they are loose units.
      ...replRows.map((r) => ({ shopId, productId: r.productId, changeQty: D(-r.quantity), type: 'SALE' as const, refType: 'exchange_replacement', refId: saleReturn.id })),
    ]
    if (stockRows.length) await tx.stockLedger.createMany({ data: stockRows })

    // Settlement of the net.
    if (Math.abs(netRefund) > 0.001) {
      if (input.settlement === 'CASH') {
        // netRefund > 0 = cash out to customer (negative payment); < 0 = cash collected (positive).
        const shiftId = await getOpenShiftId(tx, shopId, userId)
        await tx.payment.create({
          data: {
            shopId,
            invoiceId: invoice.id,
            customerId: invoice.customerId,
            amount: D(-netRefund),
            method: 'CASH',
            receivedById: userId,
            shiftId,
            note: kind === 'EXCHANGE' ? 'Exchange settlement' : 'Return refund',
          },
        })
      } else {
        // ACCOUNT_CREDIT: refund -> CREDIT (reduces udhaar / store credit); owed -> DEBIT.
        await tx.customerLedger.create({
          data: {
            shopId,
            customerId: invoice.customerId!,
            type: 'ADJUSTMENT',
            direction: netRefund > 0 ? 'CREDIT' : 'DEBIT',
            amount: D(Math.abs(netRefund)),
            refType: 'sale_return',
            refId: saleReturn.id,
          },
        })
      }
    }

    return saleReturn
  }, { maxWait: 10000, timeout: 30000 })
}
