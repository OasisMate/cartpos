import { prisma } from '@/lib/db/prisma'
import { shopDayBoundsUTC, DEFAULT_TIMEZONE } from '@/lib/utils/timezone'
import {
  sumCogs,
  lineCogs,
  summariseCostCoverage,
  type CogsLine,
  type CostCoverage,
} from './cogs'

export interface DailySummary {
  date: string
  totalSales: number
  totalInvoices: number
  totalUdhaar: number
  totalPaymentsReceived: number
  costOfGoods: number
  grossProfit: number
  /** Revenue in this period with no cost price behind it, so reported at zero profit. */
  costCoverage: CostCoverage
}

export interface RangeSummary {
  from: string
  to: string
  totalSales: number
  totalInvoices: number
  totalUdhaar: number
  totalPaymentsReceived: number
  costOfGoods: number
  grossProfit: number
  /** Revenue in this period with no cost price behind it, so reported at zero profit. */
  costCoverage: CostCoverage
}

/**
 * Cost of goods sold for COMPLETED sales in the period, plus how much of the period's revenue
 * had no cost price behind it. See lib/domain/cogs.ts for the per-line rules; in short, cost is
 * per BASE unit so a pack line must be costed on quantity × unitsPerItem, and a line with no
 * cost price is costed at its own sale value so it yields zero profit rather than pure profit.
 */
// `end` is exclusive (start of the day after the range).
async function getCostOfGoods(
  shopId: string,
  start: Date,
  end: Date
): Promise<{ cogs: number; coverage: CostCoverage }> {
  const lines = await prisma.invoiceLine.findMany({
    where: {
      invoice: { shopId, status: 'COMPLETED', createdAt: { gte: start, lt: end } },
    },
    select: {
      quantity: true,
      lineTotal: true,
      // Without this a carton of 12 is costed as a single unit, which reports a profit the
      // shop never made.
      unitsPerItem: true,
      // The cost frozen at sale time. Preferred over the product's current cost so that
      // editing a cost price cannot rewrite the profit on sales already made.
      unitCost: true,
      product: { select: { costPrice: true } },
    },
  })
  const mapped: CogsLine[] = lines.map((l) => ({
    quantity: Number(l.quantity),
    lineTotal: Number(l.lineTotal),
    unitsPerItem: Number(l.unitsPerItem),
    // Fall back to the current cost only for rows written before costs were snapshotted.
    costPrice:
      l.unitCost != null
        ? Number(l.unitCost)
        : l.product.costPrice
          ? Number(l.product.costPrice)
          : null,
  }))
  return { cogs: sumCogs(mapped), coverage: summariseCostCoverage(mapped) }
}

/**
 * Net effect of returns/exchanges in the period on sales and COGS.
 * - Returned goods reduce sales; restocked returns also reverse their COGS
 *   (damaged returns keep COGS — the cost is a loss).
 * - Exchange replacement items add sales and add COGS.
 */
async function getReturnsAdjustment(shopId: string, start: Date, end: Date) {
  const [agg, lines] = await Promise.all([
    prisma.saleReturn.aggregate({
      _sum: { returnTotal: true, replacementTotal: true },
      where: { shopId, createdAt: { gte: start, lt: end } },
    }),
    prisma.saleReturnLine.findMany({
      where: { saleReturn: { shopId, createdAt: { gte: start, lt: end } } },
      select: {
        quantity: true,
        lineTotal: true,
        isReplacement: true,
        restocked: true,
        // Present since the pack-returns fix; a returned carton reverses the cost of all its
        // base units, matching what the sale booked.
        unitsPerItem: true,
        product: { select: { costPrice: true } },
      },
    }),
  ])
  const returnTotal = Number(agg._sum.returnTotal || 0)
  const replacementTotal = Number(agg._sum.replacementTotal || 0)

  let cogsDelta = 0
  for (const l of lines) {
    const cost = lineCogs({
      quantity: Number(l.quantity),
      lineTotal: Number(l.lineTotal),
      unitsPerItem: Number(l.unitsPerItem),
      costPrice: l.product.costPrice ? Number(l.product.costPrice) : null,
    })
    if (l.isReplacement) cogsDelta += cost // new goods out
    else if (l.restocked) cogsDelta -= cost // returned to stock -> reverse COGS
  }
  return {
    salesDelta: Math.round((replacementTotal - returnTotal) * 100) / 100,
    cogsDelta: Math.round(cogsDelta * 100) / 100,
  }
}

export async function getDailySummary(
  shopId: string,
  dateISO: string,
  timezone: string = DEFAULT_TIMEZONE
): Promise<DailySummary> {
  // The given calendar date, interpreted as the shop's local day.
  const { start, endExclusive: end } = shopDayBoundsUTC(timezone, dateISO, dateISO)

  const [invoices, payments, udhaarInvoices, costOfGoods, returnsAdj] = await Promise.all([
    prisma.invoice.aggregate({
      _sum: { total: true },
      _count: { _all: true },
      where: { shopId, status: 'COMPLETED', createdAt: { gte: start, lt: end } },
    }),
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: { shopId, createdAt: { gte: start, lt: end } },
    }),
    prisma.invoice.aggregate({
      _sum: { total: true },
      where: { shopId, status: 'COMPLETED', paymentStatus: 'UDHAAR', createdAt: { gte: start, lt: end } },
    }),
    getCostOfGoods(shopId, start, end),
    getReturnsAdjustment(shopId, start, end),
  ])

  const totalSales = Math.round((Number(invoices._sum.total || 0) + returnsAdj.salesDelta) * 100) / 100
  const cogs = Math.round((costOfGoods.cogs + returnsAdj.cogsDelta) * 100) / 100
  return {
    date: dateISO,
    totalSales,
    totalInvoices: invoices._count._all || 0,
    totalUdhaar: Number(udhaarInvoices._sum.total || 0),
    totalPaymentsReceived: Number(payments._sum.amount || 0),
    costOfGoods: cogs,
    grossProfit: Math.round((totalSales - cogs) * 100) / 100,
    // How much of this revenue had no cost price behind it. Without this the shop just sees a
    // profit figure that looks too low and has no way to find out why.
    costCoverage: costOfGoods.coverage,
  }
}

export async function getRangeSummary(
  shopId: string,
  fromISO: string,
  toISO: string,
  timezone: string = DEFAULT_TIMEZONE
): Promise<RangeSummary> {
  // Interpret the selected dates as the shop's local days, converted to UTC
  // instants, so the range matches the shop's calendar (not the server's).
  const { start, endExclusive: end } = shopDayBoundsUTC(timezone, fromISO, toISO)

  const [invoices, payments, udhaarInvoices, costOfGoods, returnsAdj] = await Promise.all([
    prisma.invoice.aggregate({
      _sum: { total: true },
      _count: { _all: true },
      where: { shopId, status: 'COMPLETED', createdAt: { gte: start, lt: end } },
    }),
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: { shopId, createdAt: { gte: start, lt: end } },
    }),
    prisma.invoice.aggregate({
      _sum: { total: true },
      where: { shopId, status: 'COMPLETED', paymentStatus: 'UDHAAR', createdAt: { gte: start, lt: end } },
    }),
    getCostOfGoods(shopId, start, end),
    getReturnsAdjustment(shopId, start, end),
  ])

  const totalSales = Math.round((Number(invoices._sum.total || 0) + returnsAdj.salesDelta) * 100) / 100
  const cogs = Math.round((costOfGoods.cogs + returnsAdj.cogsDelta) * 100) / 100
  return {
    from: fromISO,
    to: toISO,
    totalSales,
    totalInvoices: invoices._count._all || 0,
    totalUdhaar: Number(udhaarInvoices._sum.total || 0),
    totalPaymentsReceived: Number(payments._sum.amount || 0),
    costOfGoods: cogs,
    grossProfit: Math.round((totalSales - cogs) * 100) / 100,
    // How much of this revenue had no cost price behind it. Without this the shop just sees a
    // profit figure that looks too low and has no way to find out why.
    costCoverage: costOfGoods.coverage,
  }
}
