import { prisma } from '@/lib/db/prisma'

export interface DailySummary {
  date: string
  totalSales: number
  totalInvoices: number
  totalUdhaar: number
  totalPaymentsReceived: number
}

export async function getDailySummary(shopId: string, dateISO: string): Promise<DailySummary> {
  const start = new Date(dateISO + 'T00:00:00.000Z')
  const end = new Date(dateISO + 'T23:59:59.999Z')

  const [invoices, payments, udhaarInvoices] = await Promise.all([
    prisma.invoice.aggregate({
      _sum: { total: true },
      _count: { _all: true },
      where: {
        shopId,
        status: 'COMPLETED',
        createdAt: { gte: start, lte: end },
      },
    }),
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: {
        shopId,
        createdAt: { gte: start, lte: end },
      },
    }),
    prisma.invoice.aggregate({
      _sum: { total: true },
      where: {
        shopId,
        status: 'COMPLETED',
        paymentStatus: 'UDHAAR',
        createdAt: { gte: start, lte: end },
      },
    }),
  ])

  return {
    date: dateISO,
    totalSales: Number(invoices._sum.total || 0),
    totalInvoices: invoices._count._all || 0,
    totalUdhaar: Number(udhaarInvoices._sum.total || 0),
    totalPaymentsReceived: Number(payments._sum.amount || 0),
  }
}

