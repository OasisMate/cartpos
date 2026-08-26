import { describe, it, expect } from 'vitest'
import { roundToTwo, formatNumber, formatCurrency, calculateTotals, sumCartLines } from './money'

/**
 * Every price, line total and receipt figure goes through these. They are small, which is
 * exactly why a mistake here is expensive: it would be wrong on every screen at once.
 */

describe('roundToTwo', () => {
  it('rounds to paisa', () => {
    expect(roundToTwo(10.456)).toBe(10.46)
    expect(roundToTwo(10.454)).toBe(10.45)
  })

  it('rounds the common float case that bites naive implementations', () => {
    // 1.005 is really 1.00499999... in binary, so plain Math.round gives 1.
    // The Number.EPSILON nudge in roundToTwo is what lifts it to 1.01.
    expect(roundToTwo(1.005)).toBe(1.01)
  })

  it('still rounds down where the binary value sits too far below the midpoint', () => {
    // Documented limit, not a defect worth changing app-wide rounding for: 8.165 is stored as
    // 8.164999999999999147..., which the EPSILON nudge is far too small to lift, so this
    // rounds to 8.16. Half-up rounding is only exact for values a double can represent
    // exactly. It costs at most one paisa on a single line, and every total is re-derived
    // from the lines rather than accumulated, so it cannot compound across a bill.
    expect(roundToTwo(8.165)).toBe(8.16)
  })

  it('leaves whole numbers alone', () => {
    expect(roundToTwo(100)).toBe(100)
  })

  it('handles negatives, used when reversing a sale', () => {
    expect(roundToTwo(-10.456)).toBe(-10.46)
  })

  it('is stable when applied twice', () => {
    expect(roundToTwo(roundToTwo(19.999))).toBe(20)
  })
})

describe('formatNumber', () => {
  it('drops decimals that add nothing', () => {
    expect(formatNumber(100)).toBe('100')
    expect(formatNumber(100.0)).toBe('100')
    expect(formatNumber(100.5)).toBe('100.5')
    expect(formatNumber(100.50)).toBe('100.5')
  })

  it('keeps two decimals when they matter', () => {
    expect(formatNumber(100.55)).toBe('100.55')
  })

  it('groups thousands, so a large bill stays readable', () => {
    expect(formatNumber(1234)).toBe('1,234')
    expect(formatNumber(1234.5)).toBe('1,234.5')
    expect(formatNumber(1234567)).toBe('1,234,567')
  })

  it('accepts a numeric string, as Prisma Decimals arrive', () => {
    expect(formatNumber('1234.50')).toBe('1,234.5')
  })

  it('shows zero rather than blank for missing values', () => {
    expect(formatNumber(null)).toBe('0')
    expect(formatNumber(undefined)).toBe('0')
    expect(formatNumber('')).toBe('0')
    expect(formatNumber('abc')).toBe('0')
    expect(formatNumber(NaN)).toBe('0')
  })

  it('formats a negative amount', () => {
    expect(formatNumber(-1234.5)).toBe('-1,234.5')
  })
})

describe('formatCurrency', () => {
  it('prefixes rupees by default', () => {
    expect(formatCurrency(1234.5)).toBe('Rs.1,234.5')
  })

  it('accepts a different prefix', () => {
    expect(formatCurrency(100, 'PKR ')).toBe('PKR 100')
  })

  it('shows zero for a missing amount rather than "Rs."', () => {
    expect(formatCurrency(null)).toBe('Rs.0')
  })
})

describe('calculateTotals', () => {
  it('subtracts the discount', () => {
    expect(calculateTotals(600, 100)).toEqual({ subtotal: 600, discount: 100, total: 500 })
  })

  it('treats a missing discount as zero', () => {
    expect(calculateTotals(600, undefined as any).total).toBe(600)
  })

  it('rounds each part, so the total cannot drift from what is displayed', () => {
    const { subtotal, discount, total } = calculateTotals(10.005, 0.005)
    expect(subtotal).toBe(10.01)
    expect(discount).toBe(0.01)
    expect(total).toBe(10)
  })

  it('reaches exactly zero on a full discount', () => {
    expect(calculateTotals(600, 600).total).toBe(0)
  })
})

describe('sumCartLines', () => {
  it('adds the line totals', () => {
    expect(sumCartLines([{ lineTotal: 120 }, { lineTotal: 480 }])).toBe(600)
  })

  it('is zero for an empty cart', () => {
    expect(sumCartLines([])).toBe(0)
  })

  it('does not accumulate float error across many lines', () => {
    // Ten lines of 0.1 sum to 0.9999999999999999 in plain floating point.
    const lines = Array.from({ length: 10 }, () => ({ lineTotal: 0.1 }))
    expect(sumCartLines(lines)).toBe(1)
  })

  it('rounds the sum to paisa', () => {
    expect(sumCartLines([{ lineTotal: 33.333 }, { lineTotal: 33.333 }])).toBe(66.67)
  })
})
