import { prisma } from '@/lib/db/prisma'
import { Prisma } from '@prisma/client'

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
  productId: string
  name: string
  unit: string
  unitPrice: number
  sold: number
  alreadyReturned: number
  returnable: number
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

  // Sum prior returned quantities per product for this invoice.
  const priorLines = await prisma.saleReturnLine.findMany({
    where: { isReplacement: false, saleReturn: { originalInvoiceId: invoiceId } },
    select: { productId: true, quantity: true },
  })
  const returnedByProduct = new Map<string, number>()
  for (const l of priorLines) {
    returnedByProduct.set(l.productId, (returnedByProduct.get(l.productId) || 0) + Number(l.quantity))
  }

  // Collapse invoice lines by product (a product can appear on multiple lines).
  const byProduct = new Map<string, ReturnableLine>()
  for (const line of invoice.lines) {
    const existing = byProduct.get(line.productId)
    const sold = Number(line.quantity)
    if (existing) {
      existing.sold += sold
    } else {
      byProduct.set(line.productId, {
        productId: line.productId,
        name: line.product.name,
        unit: line.product.unit,
        unitPrice: Number(line.unitPrice),
        sold,
        alreadyReturned: returnedByProduct.get(line.productId) || 0,
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
  returnLines: Array<{ productId: string; quantity: number; damaged?: boolean }>
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

  // Original sold + already-returned per product (server-trusted prices/quantities).
  const soldByProduct = new Map<string, { qty: number; unitPrice: number }>()
  for (const l of invoice.lines) {
    const e = soldByProduct.get(l.productId)
    if (e) e.qty += Number(l.quantity)
    else soldByProduct.set(l.productId, { qty: Number(l.quantity), unitPrice: Number(l.unitPrice) })
  }
  const prior = await prisma.saleReturnLine.findMany({
    where: { isReplacement: false, saleReturn: { originalInvoiceId: invoice.id } },
    select: { productId: true, quantity: true },
  })
  const returnedByProduct = new Map<string, number>()
  for (const l of prior) returnedByProduct.set(l.productId, (returnedByProduct.get(l.productId) || 0) + Number(l.quantity))

  // Validate + price the returned lines.
  let returnTotal = 0
  const returnRows = (input.returnLines || []).map((rl) => {
    const sold = soldByProduct.get(rl.productId)
    if (!sold) throw new Error('Returned item was not on this invoice')
    const qty = Number(rl.quantity)
    if (!(qty > 0)) throw new Error('Return quantity must be greater than zero')
    const remaining = sold.qty - (returnedByProduct.get(rl.productId) || 0)
    if (qty > remaining + 1e-6) throw new Error('Return quantity exceeds what was sold')
    const lineTotal = Math.round(qty * sold.unitPrice * 100) / 100
    returnTotal += lineTotal
    return { productId: rl.productId, quantity: qty, unitPrice: sold.unitPrice, lineTotal, damaged: !!rl.damaged }
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
    const stockRows = [
      ...returnRows
        .filter((r) => !r.damaged)
        .map((r) => ({ shopId, productId: r.productId, changeQty: D(r.quantity), type: 'RETURN' as const, refType: 'sale_return', refId: saleReturn.id })),
      ...replRows.map((r) => ({ shopId, productId: r.productId, changeQty: D(-r.quantity), type: 'SALE' as const, refType: 'exchange_replacement', refId: saleReturn.id })),
    ]
    if (stockRows.length) await tx.stockLedger.createMany({ data: stockRows })

    // Settlement of the net.
    if (Math.abs(netRefund) > 0.001) {
      if (input.settlement === 'CASH') {
        // netRefund > 0 = cash out to customer (negative payment); < 0 = cash collected (positive).
        await tx.payment.create({
          data: {
            shopId,
            invoiceId: invoice.id,
            customerId: invoice.customerId,
            amount: D(-netRefund),
            method: 'CASH',
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
