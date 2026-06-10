import { prisma } from '@/lib/db/prisma'
import { shopDayBoundsUTC, DEFAULT_TIMEZONE } from '@/lib/utils/timezone'

export interface CashBookRow {
  id: string
  date: Date
  kind: 'SALE' | 'UDHAAR_PAYMENT' | 'SUPPLIER_PAYMENT' | 'EXPENSE'
  label: string
  ref: string | null
  amount: number
}

export interface CashBook {
  shopName: string | null
  from: string
  to: string
  inflows: CashBookRow[]
  outflows: CashBookRow[]
  totals: { in: number; out: number; net: number }
}

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * Cash movement register (روزنامچہ) for a shop over a date range, in the shop's timezone.
 * IN  = cash Payments (covers both POS cash sales and udhaar cash received).
 * OUT = supplier payments made in cash + expenses (no payment method on Expense → treated as cash).
 * Shows period movement, not a drawer opening/closing balance (no cash-drawer ledger in schema).
 */
export async function getCashBook(
  shopId: string,
  fromISO: string,
  toISO: string,
  timezone: string = DEFAULT_TIMEZONE
): Promise<CashBook> {
  const { start, endExclusive: end } = shopDayBoundsUTC(timezone, fromISO, toISO)

  const [shop, payments, supplierPayments, expenses] = await Promise.all([
    prisma.shop.findUnique({ where: { id: shopId }, select: { name: true } }),
    prisma.payment.findMany({
      where: { shopId, method: 'CASH', createdAt: { gte: start, lt: end } },
      select: {
        id: true,
        amount: true,
        createdAt: true,
        invoiceId: true,
        invoice: { select: { number: true } },
        customer: { select: { name: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.supplierLedger.findMany({
      where: { shopId, type: 'PAYMENT_MADE', method: 'CASH', createdAt: { gte: start, lt: end } },
      select: { id: true, amount: true, createdAt: true, note: true, supplier: { select: { name: true } } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.expense.findMany({
      where: { shopId, date: { gte: start, lt: end } },
      select: { id: true, amount: true, date: true, category: true, description: true },
      orderBy: { date: 'asc' },
    }),
  ])

  const inflows: CashBookRow[] = payments.map((p) => {
    const isSale = !!p.invoiceId
    return {
      id: p.id,
      date: p.createdAt,
      kind: isSale ? 'SALE' : 'UDHAAR_PAYMENT',
      label: isSale ? 'Cash sale' : `Udhaar payment${p.customer?.name ? ` — ${p.customer.name}` : ''}`,
      ref: isSale ? (p.invoice?.number ? `#${p.invoice.number}` : null) : null,
      amount: Number(p.amount),
    }
  })

  const outflows: CashBookRow[] = [
    ...supplierPayments.map((s) => ({
      id: s.id,
      date: s.createdAt,
      kind: 'SUPPLIER_PAYMENT' as const,
      label: `Supplier payment${s.supplier?.name ? ` — ${s.supplier.name}` : ''}${s.note ? ` (${s.note})` : ''}`,
      ref: null,
      amount: Number(s.amount),
    })),
    ...expenses.map((e) => ({
      id: e.id,
      date: e.date,
      kind: 'EXPENSE' as const,
      label: `Expense — ${e.category}${e.description ? ` (${e.description})` : ''}`,
      ref: null,
      amount: Number(e.amount),
    })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime())

  const totalIn = round2(inflows.reduce((s, r) => s + r.amount, 0))
  const totalOut = round2(outflows.reduce((s, r) => s + r.amount, 0))

  return {
    shopName: shop?.name ?? null,
    from: fromISO,
    to: toISO,
    inflows,
    outflows,
    totals: { in: totalIn, out: totalOut, net: round2(totalIn - totalOut) },
  }
}
