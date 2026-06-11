import { prisma } from '@/lib/db/prisma'
import { shopDayBoundsUTC, DEFAULT_TIMEZONE } from '@/lib/utils/timezone'
import { getDailySummary } from './reports'
import { getCashBook } from './cashbook'

/**
 * End-of-day Z-report: the nightly till close for one shop day.
 * Composes the daily summary + cash book so the owner can reconcile the drawer,
 * see the sales/payment mix, receivables movement and profit on one page.
 */
export interface ZReport {
  date: string
  shopName: string | null
  // Sales
  totalSales: number
  totalInvoices: number
  salesByMethod: { cash: number; card: number; other: number; udhaar: number }
  // Cash drawer reconciliation
  cashIn: number
  cashOut: number
  cashNet: number
  cashOutBreakdown: { refunds: number; supplierPayments: number; expenses: number }
  // Receivables (udhaar)
  udhaarGiven: number
  paymentsReceived: number
  // Profit
  costOfGoods: number
  grossProfit: number
  // Returns / refunds
  returnsCount: number
  returnsRefundValue: number
}

const round2 = (n: number) => Math.round(n * 100) / 100

export async function getZReport(
  shopId: string,
  dateISO: string,
  timezone: string = DEFAULT_TIMEZONE
): Promise<ZReport> {
  const { start, endExclusive: end } = shopDayBoundsUTC(timezone, dateISO, dateISO)

  const [summary, book, byMethod, returnsAgg] = await Promise.all([
    getDailySummary(shopId, dateISO, timezone),
    getCashBook(shopId, dateISO, dateISO, timezone),
    // Non-udhaar completed sales grouped by how they were paid.
    prisma.invoice.groupBy({
      by: ['paymentMethod'],
      _sum: { total: true },
      where: {
        shopId,
        status: 'COMPLETED',
        paymentStatus: { not: 'UDHAAR' },
        createdAt: { gte: start, lt: end },
      },
    }),
    prisma.saleReturn.aggregate({
      _count: { _all: true },
      _sum: { netRefund: true },
      where: { shopId, createdAt: { gte: start, lt: end } },
    }),
  ])

  const methodSum = (m: 'CASH' | 'CARD' | 'OTHER') =>
    round2(byMethod.filter((r) => r.paymentMethod === m).reduce((s, r) => s + Number(r._sum.total || 0), 0))

  const cashOutBreakdown = { refunds: 0, supplierPayments: 0, expenses: 0 }
  for (const r of book.outflows) {
    if (r.kind === 'REFUND') cashOutBreakdown.refunds += r.amount
    else if (r.kind === 'SUPPLIER_PAYMENT') cashOutBreakdown.supplierPayments += r.amount
    else if (r.kind === 'EXPENSE') cashOutBreakdown.expenses += r.amount
  }

  return {
    date: dateISO,
    shopName: book.shopName,
    totalSales: summary.totalSales,
    totalInvoices: summary.totalInvoices,
    salesByMethod: {
      cash: methodSum('CASH'),
      card: methodSum('CARD'),
      other: methodSum('OTHER'),
      udhaar: round2(summary.totalUdhaar),
    },
    cashIn: book.totals.in,
    cashOut: book.totals.out,
    cashNet: book.totals.net,
    cashOutBreakdown: {
      refunds: round2(cashOutBreakdown.refunds),
      supplierPayments: round2(cashOutBreakdown.supplierPayments),
      expenses: round2(cashOutBreakdown.expenses),
    },
    udhaarGiven: round2(summary.totalUdhaar),
    paymentsReceived: round2(summary.totalPaymentsReceived),
    costOfGoods: summary.costOfGoods,
    grossProfit: summary.grossProfit,
    returnsCount: returnsAgg._count._all || 0,
    returnsRefundValue: round2(Number(returnsAgg._sum.netRefund || 0)),
  }
}
