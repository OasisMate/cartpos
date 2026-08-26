import { describe, it, expect } from 'vitest'
import {
  validateSaleTotals,
  validateSaleLines,
  validateSaleHeader,
  type SaleTotalsInput,
} from './saleTotals'

/** A well-formed cash sale: 2 x 60 + 1 x 480 = 600. */
function sale(over: Partial<SaleTotalsInput> = {}): SaleTotalsInput {
  return {
    items: [
      { quantity: 2, unitPrice: 60, lineTotal: 120 },
      { quantity: 1, unitPrice: 480, lineTotal: 480 },
    ],
    subtotal: 600,
    discount: 0,
    total: 600,
    paymentStatus: 'PAID',
    paymentMethod: 'CASH',
    ...over,
  }
}

describe('line validation', () => {
  it('accepts a normal line', () => {
    expect(() => validateSaleLines([{ quantity: 2, unitPrice: 60, lineTotal: 120 }])).not.toThrow()
  })

  it('accepts decimal quantities, for goods sold by weight', () => {
    expect(() =>
      validateSaleLines([{ quantity: 1.75, unitPrice: 200, lineTotal: 350 }])
    ).not.toThrow()
  })

  it('accepts a free line, for a giveaway priced at zero', () => {
    expect(() => validateSaleLines([{ quantity: 1, unitPrice: 0, lineTotal: 0 }])).not.toThrow()
  })

  it.each([0, -1, NaN, Infinity])('rejects a quantity of %s', (quantity) => {
    expect(() => validateSaleLines([{ quantity, unitPrice: 60, lineTotal: 60 }])).toThrow(
      /quantity greater than 0/
    )
  })

  it.each([-1, NaN, Infinity])('rejects a unit price of %s', (unitPrice) => {
    expect(() => validateSaleLines([{ quantity: 1, unitPrice, lineTotal: 1 }])).toThrow(
      /Invalid item price/
    )
  })

  it('rejects a negative line total', () => {
    expect(() => validateSaleLines([{ quantity: 1, unitPrice: 60, lineTotal: -60 }])).toThrow(
      /Invalid item price/
    )
  })

  it('rejects a line total that does not match quantity x price', () => {
    // The important one: a client claiming 2 x 60 = 100.
    expect(() => validateSaleLines([{ quantity: 2, unitPrice: 60, lineTotal: 100 }])).toThrow(
      /does not match/
    )
  })

  it('tolerates rounding noise within a paisa', () => {
    expect(() =>
      validateSaleLines([{ quantity: 3, unitPrice: 33.33, lineTotal: 99.99 }])
    ).not.toThrow()
  })

  it('accepts an empty list here, because emptiness is checked upstream', () => {
    expect(() => validateSaleLines([])).not.toThrow()
  })
})

describe('header validation', () => {
  it('rejects a negative discount, which would inflate the total', () => {
    expect(() => validateSaleHeader(sale({ discount: -50 }))).toThrow(/Invalid sale totals/)
  })

  it.each(['subtotal', 'discount', 'total'] as const)('rejects a non-finite %s', (field) => {
    expect(() => validateSaleHeader(sale({ [field]: NaN } as any))).toThrow(/Invalid sale totals/)
  })
})

describe('totals', () => {
  it('accepts a straightforward cash sale', () => {
    expect(() => validateSaleTotals(sale())).not.toThrow()
  })

  it('applies a discount', () => {
    expect(() => validateSaleTotals(sale({ discount: 100, total: 500 }))).not.toThrow()
  })

  it('rejects a total that does not match the lines', () => {
    expect(() => validateSaleTotals(sale({ total: 500 }))).toThrow(/Total calculation mismatch/)
  })

  it('rejects a discount silently dropped from the total', () => {
    expect(() => validateSaleTotals(sale({ discount: 100, total: 600 }))).toThrow(
      /Total calculation mismatch/
    )
  })

  it('adds service and delivery on top of the discounted base', () => {
    const result = validateSaleTotals(
      sale({ discount: 100, serviceCharge: 50, deliveryCharge: 30, total: 580 })
    )
    expect(result.preCardTotal).toBeCloseTo(580, 2)
  })

  it.each([-1, NaN])('rejects a service charge of %s', (serviceCharge) => {
    expect(() => validateSaleTotals(sale({ serviceCharge, total: 600 }))).toThrow(
      /Invalid service or delivery charge/
    )
  })

  it('rejects a negative delivery charge', () => {
    expect(() => validateSaleTotals(sale({ deliveryCharge: -30, total: 600 }))).toThrow(
      /Invalid service or delivery charge/
    )
  })

  it('ignores service and delivery when the client omits them', () => {
    const result = validateSaleTotals(sale())
    expect(result.serviceCharge).toBe(0)
    expect(result.deliveryCharge).toBe(0)
  })
})

describe('card fee', () => {
  const card = (over: Partial<SaleTotalsInput> = {}) =>
    sale({ paymentMethod: 'CARD', ...over })

  it('accepts the shop-configured fee', () => {
    // 2% of 600 = 12
    const result = validateSaleTotals(card({ total: 612 }), { cardFeePercent: 2 })
    expect(result.cardFee).toBeCloseTo(12, 2)
  })

  it('accepts no fee at all, so an offline sale rung up before settings loaded still syncs', () => {
    // This is the case that must never be refused: the money already changed hands, and
    // rejecting it forever would stall the whole sync queue.
    expect(() => validateSaleTotals(card({ total: 600 }), { cardFeePercent: 2 })).not.toThrow()
  })

  it('rejects a fee above the configured percentage when override is off', () => {
    expect(() => validateSaleTotals(card({ total: 700 }), { cardFeePercent: 2 })).toThrow(
      /Total calculation mismatch/
    )
  })

  it('allows a cashier to raise the fee when override is on', () => {
    expect(() =>
      validateSaleTotals(card({ total: 700 }), { cardFeePercent: 2, allowCardFeeOverride: true })
    ).not.toThrow()
  })

  it('still caps an overridden fee at the pre-card total', () => {
    expect(() =>
      validateSaleTotals(card({ total: 1300 }), { cardFeePercent: 2, allowCardFeeOverride: true })
    ).toThrow(/Total calculation mismatch/)
  })

  it('rejects a total below the pre-card total, i.e. a negative fee', () => {
    expect(() => validateSaleTotals(card({ total: 500 }), { cardFeePercent: 2 })).toThrow(
      /Total calculation mismatch/
    )
  })

  it('charges no fee when the shop has none configured', () => {
    expect(() => validateSaleTotals(card({ total: 612 }), {})).toThrow(
      /Total calculation mismatch/
    )
  })

  it('does not apply a card fee to an udhaar sale', () => {
    const result = validateSaleTotals(
      sale({ paymentStatus: 'UDHAAR', paymentMethod: undefined, total: 600 }),
      { cardFeePercent: 2 }
    )
    expect(result.cardFee).toBe(0)
  })

  it('does not apply a card fee to a cash sale', () => {
    expect(() => validateSaleTotals(sale({ total: 612 }), { cardFeePercent: 2 })).toThrow(
      /Total calculation mismatch/
    )
  })
})

describe('tampering a shop would actually care about', () => {
  it('refuses a total lower than the goods handed over', () => {
    expect(() => validateSaleTotals(sale({ total: 1 }))).toThrow(/Total calculation mismatch/)
  })

  it('refuses a subtotal that disagrees with the lines it claims to sum', () => {
    // Lines total 600; a client claiming the subtotal is 100 gets caught by the total check.
    expect(() => validateSaleTotals(sale({ subtotal: 100, total: 100 }))).toThrow(
      /Total calculation mismatch/
    )
  })

  it('refuses a discount larger than the sale, which would owe the customer money', () => {
    // Every other check passes here: the discount is positive and the total matches
    // subtotal - discount exactly. Without an explicit cap this writes a -400 invoice.
    expect(() => validateSaleTotals(sale({ discount: 1000, total: -400 }))).toThrow(
      /Discount cannot exceed/
    )
  })

  it('allows a discount that takes the sale to exactly zero', () => {
    expect(() => validateSaleTotals(sale({ discount: 600, total: 0 }))).not.toThrow()
  })

  it('refuses an over-discount even when a service charge would mask it', () => {
    // preCardTotal comes back positive (600 - 1000 + 500 = 100), so the total check alone
    // would wave this through.
    expect(() =>
      validateSaleTotals(sale({ discount: 1000, serviceCharge: 500, total: 100 }))
    ).toThrow(/Discount cannot exceed/)
  })
})
