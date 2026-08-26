import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db/prisma', () => ({ prisma: {} }))
const getOpenShiftId = vi.fn()
vi.mock('./shifts', () => ({ getOpenShiftId: () => getOpenShiftId() }))

import { applySaleEffects } from './sales'

/**
 * Records what a sale writes, without a database. These assertions are the ledger invariants:
 * stock leaves the shop, cash is attributed to a drawer, and credit lands on the right khata.
 */
function stubTx() {
  const calls = {
    invoiceLines: [] as any[],
    stockLedger: [] as any[],
    payments: [] as any[],
    customerLedger: [] as any[],
    lotUpdates: [] as any[],
  }
  const lots: any[] = []
  const tx: any = {
    invoiceLine: {
      createMany: vi.fn(async ({ data }: any) => {
        calls.invoiceLines.push(...data)
      }),
      findMany: vi.fn(async () =>
        calls.invoiceLines.map((l, i) => ({ id: `line_${i}`, productId: l.productId }))
      ),
    },
    stockLedger: {
      createMany: vi.fn(async ({ data }: any) => {
        calls.stockLedger.push(...data)
      }),
    },
    stockLot: {
      findMany: vi.fn(async () => lots),
      update: vi.fn(async (args: any) => {
        calls.lotUpdates.push(args)
      }),
    },
    payment: { create: vi.fn(async ({ data }: any) => void calls.payments.push(data)) },
    customerLedger: {
      create: vi.fn(async ({ data }: any) => void calls.customerLedger.push(data)),
    },
  }
  return { tx, calls, lots }
}

const PRODUCT = { id: 'p1', trackStock: true, costPrice: 45 } as any
const num = (d: any) => Number(d.toString())

function run(tx: any, input: any, products: any[] = [PRODUCT], batchExpiryOn = false) {
  return applySaleEffects(tx, {
    invoiceId: 'inv_1',
    shopId: 'shop_1',
    input,
    userId: 'user_1',
    products,
    batchExpiryOn,
  } as any)
}

const cashSale = (over: any = {}) => ({
  items: [{ productId: 'p1', quantity: 2, unitPrice: 60, lineTotal: 120 }],
  subtotal: 120,
  discount: 0,
  total: 120,
  paymentStatus: 'PAID',
  paymentMethod: 'CASH',
  ...over,
})

beforeEach(() => {
  getOpenShiftId.mockReset()
  getOpenShiftId.mockResolvedValue('shift_1')
})

describe('stock ledger', () => {
  it('removes stock from the shop, never adds it', async () => {
    const { tx, calls } = stubTx()
    await run(tx, cashSale())
    expect(calls.stockLedger).toHaveLength(1)
    expect(num(calls.stockLedger[0].changeQty)).toBe(-2)
    expect(calls.stockLedger[0].type).toBe('SALE')
  })

  it('draws base units for a pack sale, not pack count', async () => {
    // One carton of 12 must remove 12 units from stock, not 1.
    const { tx, calls } = stubTx()
    await run(
      tx,
      cashSale({
        items: [
          {
            productId: 'p1',
            quantity: 1,
            unitPrice: 700,
            lineTotal: 700,
            unitsPerItem: 12,
            packName: 'Carton',
          },
        ],
        subtotal: 700,
        total: 700,
      })
    )
    expect(num(calls.stockLedger[0].changeQty)).toBe(-12)
  })

  it('keeps the pack quantity and per-pack price on the invoice line', async () => {
    const { tx, calls } = stubTx()
    await run(
      tx,
      cashSale({
        items: [
          {
            productId: 'p1',
            quantity: 2,
            unitPrice: 700,
            lineTotal: 1400,
            unitsPerItem: 12,
            packName: 'Carton',
          },
        ],
        subtotal: 1400,
        total: 1400,
      })
    )
    const line = calls.invoiceLines[0]
    expect(num(line.quantity)).toBe(2)
    expect(num(line.unitPrice)).toBe(700)
    expect(line.packName).toBe('Carton')
    expect(num(line.unitsPerItem)).toBe(12)
    // ...while stock still moves in base units.
    expect(num(calls.stockLedger[0].changeQty)).toBe(-24)
  })

  it('treats a missing unitsPerItem as a loose unit', async () => {
    const { tx, calls } = stubTx()
    await run(tx, cashSale())
    expect(num(calls.invoiceLines[0].unitsPerItem)).toBe(1)
  })

  it('writes one ledger row per line', async () => {
    const { tx, calls } = stubTx()
    await run(
      tx,
      cashSale({
        items: [
          { productId: 'p1', quantity: 2, unitPrice: 60, lineTotal: 120 },
          { productId: 'p1', quantity: 1, unitPrice: 60, lineTotal: 60 },
        ],
        subtotal: 180,
        total: 180,
      })
    )
    expect(calls.stockLedger).toHaveLength(2)
    expect(calls.stockLedger.map((r) => num(r.changeQty))).toEqual([-2, -1])
  })
})

describe('a paid sale', () => {
  it('records the full total as one payment', async () => {
    const { tx, calls } = stubTx()
    await run(tx, cashSale())
    expect(calls.payments).toHaveLength(1)
    expect(num(calls.payments[0].amount)).toBe(120)
    expect(calls.payments[0].method).toBe('CASH')
  })

  it('attributes the cash to the cashier and their open drawer', async () => {
    const { tx, calls } = stubTx()
    await run(tx, cashSale())
    expect(calls.payments[0].receivedById).toBe('user_1')
    expect(calls.payments[0].shiftId).toBe('shift_1')
  })

  it('still records the payment when no drawer is open', async () => {
    getOpenShiftId.mockResolvedValue(null)
    const { tx, calls } = stubTx()
    await run(tx, cashSale())
    expect(calls.payments).toHaveLength(1)
    expect(calls.payments[0].shiftId).toBeNull()
  })

  it('puts nothing on any customer khata', async () => {
    const { tx, calls } = stubTx()
    await run(tx, cashSale())
    expect(calls.customerLedger).toHaveLength(0)
  })
})

describe('an udhaar sale', () => {
  const udhaar = (over: any = {}) =>
    cashSale({ paymentStatus: 'UDHAAR', paymentMethod: undefined, customerId: 'c1', ...over })

  it('debits the customer for the full total', async () => {
    const { tx, calls } = stubTx()
    await run(tx, udhaar())
    expect(calls.customerLedger).toHaveLength(1)
    expect(calls.customerLedger[0]).toMatchObject({
      customerId: 'c1',
      type: 'SALE_UDHAAR',
      direction: 'DEBIT',
    })
    expect(num(calls.customerLedger[0].amount)).toBe(120)
  })

  it('takes no cash when nothing was handed over', async () => {
    const { tx, calls } = stubTx()
    await run(tx, udhaar())
    expect(calls.payments).toHaveLength(0)
  })

  it('records part payment as cash in the drawer and a credit on the khata', async () => {
    const { tx, calls } = stubTx()
    await run(tx, udhaar({ paidNow: 50 }))
    expect(num(calls.payments[0].amount)).toBe(50)
    const credit = calls.customerLedger.find((e) => e.direction === 'CREDIT')
    expect(num(credit.amount)).toBe(50)
    expect(credit.type).toBe('PAYMENT_RECEIVED')
  })

  it('leaves the debit at the full total when part payment is made', async () => {
    // The customer still owes 120 and separately paid 50; netting them would lose the history.
    const { tx, calls } = stubTx()
    await run(tx, udhaar({ paidNow: 50 }))
    const debit = calls.customerLedger.find((e) => e.direction === 'DEBIT')
    expect(num(debit.amount)).toBe(120)
  })

  it('accepts cash above the bill, which clears older khata', async () => {
    const { tx, calls } = stubTx()
    await run(tx, udhaar({ paidNow: 500 }))
    expect(num(calls.payments[0].amount)).toBe(500)
    expect(num(calls.customerLedger.find((e) => e.direction === 'CREDIT').amount)).toBe(500)
  })

  it('ignores a zero paidNow rather than writing an empty payment', async () => {
    const { tx, calls } = stubTx()
    await run(tx, udhaar({ paidNow: 0 }))
    expect(calls.payments).toHaveLength(0)
    expect(calls.customerLedger).toHaveLength(1)
  })

  it('ties both entries to the invoice, so an edit can reverse them together', async () => {
    const { tx, calls } = stubTx()
    await run(tx, udhaar({ paidNow: 50 }))
    for (const e of calls.customerLedger) {
      expect(e.refType).toBe('invoice')
      expect(e.refId).toBe('inv_1')
    }
  })
})

describe('batch/expiry shops', () => {
  it('draws from the earliest-expiring lot first', async () => {
    const { tx, calls, lots } = stubTx()
    // The real query orders by expiry; the stub returns them already ordered.
    lots.push({ id: 'lot_old', quantity: 1 }, { id: 'lot_new', quantity: 10 })
    await run(tx, cashSale(), [PRODUCT], true)
    expect(calls.lotUpdates[0].where.id).toBe('lot_old')
    expect(num(calls.lotUpdates[0].data.quantity)).toBe(0)
    // Remainder spills to the next lot.
    expect(calls.lotUpdates[1].where.id).toBe('lot_new')
    expect(num(calls.lotUpdates[1].data.quantity)).toBe(9)
  })

  it('stops once the sold quantity is covered', async () => {
    const { tx, calls, lots } = stubTx()
    lots.push({ id: 'lot_a', quantity: 50 }, { id: 'lot_b', quantity: 50 })
    await run(tx, cashSale(), [PRODUCT], true)
    expect(calls.lotUpdates).toHaveLength(1)
  })

  it('does not touch lots for a product that does not track stock', async () => {
    const { tx, calls } = stubTx()
    await run(tx, cashSale(), [{ id: 'p1', trackStock: false } as any], true)
    expect(calls.lotUpdates).toHaveLength(0)
  })

  it('does not touch lots when the shop has batch tracking off', async () => {
    const { tx, calls, lots } = stubTx()
    lots.push({ id: 'lot_a', quantity: 50 })
    await run(tx, cashSale(), [PRODUCT], false)
    expect(calls.lotUpdates).toHaveLength(0)
  })
})

describe('cost is frozen at the moment of sale', () => {
  it('copies the product cost onto the line', async () => {
    // unitPrice was always snapshotted; cost was not, so editing a cost price rewrote the
    // reported profit of every past sale of that product.
    const { tx, calls } = stubTx()
    await run(tx, cashSale())
    expect(num(calls.invoiceLines[0].unitCost)).toBe(45)
  })

  it('stores the cost per BASE unit even for a pack sale', async () => {
    // The line records 2 cartons; the cost stays per base unit so reporting multiplies by
    // quantity x unitsPerItem rather than double-counting the pack size.
    const { tx, calls } = stubTx()
    await run(
      tx,
      cashSale({
        items: [
          {
            productId: 'p1',
            quantity: 2,
            unitPrice: 700,
            lineTotal: 1400,
            unitsPerItem: 12,
            packName: 'Carton',
          },
        ],
        subtotal: 1400,
        total: 1400,
      })
    )
    expect(num(calls.invoiceLines[0].unitCost)).toBe(45)
    expect(num(calls.invoiceLines[0].unitsPerItem)).toBe(12)
  })

  it('leaves the cost null when the product has none, so reporting can say so', async () => {
    const { tx, calls } = stubTx()
    await run(tx, cashSale(), [{ id: 'p1', trackStock: true, costPrice: null } as any])
    expect(calls.invoiceLines[0].unitCost).toBeNull()
  })

  it('is unaffected by a later change to the product cost', async () => {
    // Two sales of the same product at different costs keep their own.
    const first = stubTx()
    await run(first.tx, cashSale(), [{ id: 'p1', trackStock: true, costPrice: 45 } as any])
    const second = stubTx()
    await run(second.tx, cashSale(), [{ id: 'p1', trackStock: true, costPrice: 60 } as any])
    expect(num(first.calls.invoiceLines[0].unitCost)).toBe(45)
    expect(num(second.calls.invoiceLines[0].unitCost)).toBe(60)
  })
})
