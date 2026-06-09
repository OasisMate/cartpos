import { prisma } from '@/lib/db/prisma'
import { shopDayBoundsUTC, DEFAULT_TIMEZONE } from '@/lib/utils/timezone'

export interface DailySummary {
  date: string
  totalSales: number
  totalInvoices: number
  totalUdhaar: number
  totalPaymentsReceived: number
  costOfGoods: number
  grossProfit: number
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
}

/**
 * Cost of goods sold for COMPLETED sales in the period = Σ(product.costPrice × qty).
 * Products without a cost price contribute 0 (profit for those can't be computed).
 */
// `end` is exclusive (start of the day after the range).
async function getCostOfGoods(shopId: string, start: Date, end: Date): Promise<number> {
  const lines = await prisma.invoiceLine.findMany({
    where: {
      invoice: { shopId, status: 'COMPLETED', createdAt: { gte: start, lt: end } },
    },
    select: { quantity: true, product: { select: { costPrice: true } } },
  })
  let cogs = 0
  for (const l of lines) {
    const cost = l.product.costPrice ? Number(l.product.costPrice) : 0
    cogs += cost * Number(l.quantity)
  }
  return Math.round(cogs * 100) / 100
}

export async function getDailySummary(
  shopId: string,
  dateISO: string,
  timezone: string = DEFAULT_TIMEZONE
): Promise<DailySummary> {
  // The given calendar date, interpreted as the shop's local day.
  const { start, endExclusive: end } = shopDayBoundsUTC(timezone, dateISO, dateISO)

  const [invoices, payments, udhaarInvoices, costOfGoods] = await Promise.all([
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
  ])

  const totalSales = Number(invoices._sum.total || 0)
  return {
    date: dateISO,
    totalSales,
    totalInvoices: invoices._count._all || 0,
    totalUdhaar: Number(udhaarInvoices._sum.total || 0),
    totalPaymentsReceived: Number(payments._sum.amount || 0),
    costOfGoods,
    grossProfit: Math.round((totalSales - costOfGoods) * 100) / 100,
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

  const [invoices, payments, udhaarInvoices, costOfGoods] = await Promise.all([
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
  ])

  const totalSales = Number(invoices._sum.total || 0)
  return {
    from: fromISO,
    to: toISO,
    totalSales,
    totalInvoices: invoices._count._all || 0,
    totalUdhaar: Number(udhaarInvoices._sum.total || 0),
    totalPaymentsReceived: Number(payments._sum.amount || 0),
    costOfGoods,
    grossProfit: Math.round((totalSales - costOfGoods) * 100) / 100,
  }
}
