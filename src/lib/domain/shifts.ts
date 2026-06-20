import { prisma } from '@/lib/db/prisma'
import { Decimal } from '@prisma/client/runtime/library'
import { roundToTwo } from '@/lib/utils/money'
import type { Prisma, PrismaClient } from '@prisma/client'

// Either the global client or a transaction client works for the lookup helpers.
type Db = PrismaClient | Prisma.TransactionClient

export interface ExpectedCashBreakdown {
  openingFloat: number
  cashIn: number          // cash sales + udhaar cash received (positive payments)
  refunds: number         // cash refunds paid out (abs of negative payments)
  expenses: number        // cash expenses paid from the drawer
  supplierCash: number    // cash supplier payments from the drawer
  manualIn: number        // CashMovement IN (pay-in / float add)
  manualOut: number       // CashMovement OUT (bank drop / owner draw / pay-out)
  expected: number        // resulting expected drawer cash
}

/** The caller's currently-open shift for a shop (or null). Works inside a transaction. */
export async function getOpenShift(db: Db, shopId: string, userId: string) {
  return db.shift.findFirst({
    where: { shopId, openedById: userId, status: 'OPEN' },
    orderBy: { openedAt: 'desc' },
  })
}

/** Open-shift id only — convenience for stamping cash writes. */
export async function getOpenShiftId(db: Db, shopId: string, userId: string): Promise<string | null> {
  const s = await getOpenShift(db, shopId, userId)
  return s?.id ?? null
}

/** Open a drawer. Rejects if the user already has an open drawer in this shop. */
export async function openShift(
  shopId: string,
  userId: string,
  openingFloat: number,
  label?: string | null,
) {
  if (!Number.isFinite(openingFloat) || openingFloat < 0) {
    throw new Error('Opening float must be zero or more')
  }
  return prisma.$transaction(async (tx) => {
    const existing = await getOpenShift(tx, shopId, userId)
    if (existing) throw new Error('You already have an open drawer. Close it before opening another.')
    return tx.shift.create({
      data: {
        shopId,
        openedById: userId,
        label: label?.trim() || null,
        openingFloat: new Decimal(roundToTwo(openingFloat)),
        status: 'OPEN',
      },
    })
  })
}

/** Live expected-cash computation for a shift. Safe on open or closed shifts. */
export async function computeExpectedCash(shiftId: string): Promise<ExpectedCashBreakdown> {
  const shift = await prisma.shift.findUnique({ where: { id: shiftId }, select: { openingFloat: true } })
  if (!shift) throw new Error('Shift not found')

  const [cashInAgg, refundAgg, expenseAgg, supplierAgg, inAgg, outAgg] = await Promise.all([
    prisma.payment.aggregate({ _sum: { amount: true }, where: { shiftId, method: 'CASH', amount: { gte: 0 } } }),
    prisma.payment.aggregate({ _sum: { amount: true }, where: { shiftId, method: 'CASH', amount: { lt: 0 } } }),
    prisma.expense.aggregate({ _sum: { amount: true }, where: { shiftId } }),
    prisma.supplierLedger.aggregate({ _sum: { amount: true }, where: { shiftId, type: 'PAYMENT_MADE', method: 'CASH' } }),
    prisma.cashMovement.aggregate({ _sum: { amount: true }, where: { shiftId, direction: 'IN' } }),
    prisma.cashMovement.aggregate({ _sum: { amount: true }, where: { shiftId, direction: 'OUT' } }),
  ])

  const openingFloat = Number(shift.openingFloat)
  const cashIn = Number(cashInAgg._sum.amount ?? 0)
  const refunds = Math.abs(Number(refundAgg._sum.amount ?? 0))
  const expenses = Number(expenseAgg._sum.amount ?? 0)
  const supplierCash = Number(supplierAgg._sum.amount ?? 0)
  const manualIn = Number(inAgg._sum.amount ?? 0)
  const manualOut = Number(outAgg._sum.amount ?? 0)

  const expected = roundToTwo(
    openingFloat + cashIn - refunds - expenses - supplierCash + manualIn - manualOut,
  )

  return { openingFloat, cashIn, refunds, expenses, supplierCash, manualIn, manualOut, expected }
}

/** Close a drawer: snapshot expected cash + counted cash + variance. */
export async function closeShift(
  shiftId: string,
  closedByUserId: string,
  countedCash: number,
  note?: string | null,
) {
  if (!Number.isFinite(countedCash) || countedCash < 0) {
    throw new Error('Counted cash must be zero or more')
  }
  const shift = await prisma.shift.findUnique({ where: { id: shiftId } })
  if (!shift) throw new Error('Shift not found')
  if (shift.status === 'CLOSED') throw new Error('This drawer is already closed')

  const breakdown = await computeExpectedCash(shiftId)
  const counted = roundToTwo(countedCash)
  const variance = roundToTwo(counted - breakdown.expected)

  return prisma.shift.update({
    where: { id: shiftId },
    data: {
      status: 'CLOSED',
      closedById: closedByUserId,
      closedAt: new Date(),
      countedCash: new Decimal(counted),
      expectedCash: new Decimal(breakdown.expected),
      variance: new Decimal(variance),
      closingNote: note?.trim() || null,
    },
  })
}

/** Record a manual cash in/out against an open shift. */
export async function recordCashMovement(
  shopId: string,
  shiftId: string,
  userId: string,
  direction: 'IN' | 'OUT',
  type: 'PAY_IN' | 'PAY_OUT' | 'BANK_DROP' | 'OWNER_DRAW' | 'FLOAT_ADD' | 'OTHER',
  amount: number,
  reason?: string | null,
) {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Amount must be greater than zero')
  const shift = await prisma.shift.findUnique({ where: { id: shiftId }, select: { id: true, shopId: true, status: true } })
  if (!shift || shift.shopId !== shopId) throw new Error('Drawer not found')
  if (shift.status === 'CLOSED') throw new Error('Cannot record cash on a closed drawer')

  return prisma.cashMovement.create({
    data: {
      shopId,
      shiftId,
      userId,
      direction,
      type,
      amount: new Decimal(roundToTwo(amount)),
      reason: reason?.trim() || null,
    },
  })
}

/** Full detail for one shift: the record, its manual movements, and live expected cash. */
export async function getShiftDetail(shiftId: string) {
  const shift = await prisma.shift.findUnique({
    where: { id: shiftId },
    include: {
      openedBy: { select: { id: true, name: true } },
      closedBy: { select: { id: true, name: true } },
      movements: { orderBy: { createdAt: 'asc' }, include: { user: { select: { name: true } } } },
    },
  })
  if (!shift) return null
  const breakdown = await computeExpectedCash(shiftId)
  return { shift, breakdown }
}

/** List shifts for a shop (manager view), newest first. */
export async function listShifts(
  shopId: string,
  opts: { status?: 'OPEN' | 'CLOSED'; openedById?: string; from?: Date; to?: Date } = {},
) {
  return prisma.shift.findMany({
    where: {
      shopId,
      ...(opts.status ? { status: opts.status } : {}),
      ...(opts.openedById ? { openedById: opts.openedById } : {}),
      ...(opts.from || opts.to
        ? { openedAt: { ...(opts.from ? { gte: opts.from } : {}), ...(opts.to ? { lt: opts.to } : {}) } }
        : {}),
    },
    orderBy: { openedAt: 'desc' },
    include: {
      openedBy: { select: { id: true, name: true } },
      closedBy: { select: { id: true, name: true } },
    },
    take: 200,
  })
}
