import { describe, it, expect } from 'vitest'
import {
  lineCogs,
  sumCogs,
  baseUnitsOf,
  isCostUnknown,
  summariseCostCoverage,
  type CogsLine,
} from './cogs'

/**
 * Profit is revenue minus this. A shopkeeper checks these numbers against what is in the till,
 * so being wrong here is the kind of bug that loses trust in the whole product.
 */

const loose = (over: Partial<CogsLine> = {}): CogsLine => ({
  quantity: 3,
  lineTotal: 300,
  unitsPerItem: 1,
  costPrice: 80,
  ...over,
})

describe('base units', () => {
  it('is the quantity itself for a loose sale', () => {
    expect(baseUnitsOf(loose())).toBe(3)
  })

  it('multiplies out a pack', () => {
    // 2 cartons of 12 is 24 base units.
    expect(baseUnitsOf(loose({ quantity: 2, unitsPerItem: 12 }))).toBe(24)
  })

  it.each([undefined, null, 0, -1, NaN])('treats %s as a loose unit', (unitsPerItem) => {
    expect(baseUnitsOf(loose({ quantity: 3, unitsPerItem: unitsPerItem as any }))).toBe(3)
  })
})

describe('cost of one line', () => {
  it('costs a loose sale at cost x quantity', () => {
    expect(lineCogs(loose())).toBe(240)
  })

  it('costs a pack on base units, not pack count', () => {
    // THE BUG THIS MODULE EXISTS FOR: 2 cartons of 12 at a cost of 80 per base unit is 1920,
    // not 160. Costing it at 160 reports a profit the shop never made.
    const line = loose({ quantity: 2, unitsPerItem: 12, lineTotal: 2200, costPrice: 80 })
    expect(lineCogs(line)).toBe(1920)
  })

  it('books a line with no cost price at its sale value, so it yields zero profit', () => {
    const line = loose({ costPrice: null, lineTotal: 300 })
    expect(lineCogs(line)).toBe(300)
  })

  it.each([null, undefined, 0])('treats a cost price of %s as unknown', (costPrice) => {
    expect(isCostUnknown(loose({ costPrice: costPrice as any }))).toBe(true)
  })

  it('never reports an unknown-cost line as pure profit', () => {
    // The dangerous direction: costing it at 0 would show the whole sale as profit.
    const line = loose({ costPrice: 0, lineTotal: 5000 })
    expect(lineCogs(line)).toBe(5000)
  })

  it('costs a free giveaway at zero', () => {
    expect(lineCogs(loose({ quantity: 1, lineTotal: 0, costPrice: null }))).toBe(0)
  })
})

describe('summing a period', () => {
  it('adds the lines', () => {
    expect(sumCogs([loose(), loose()])).toBe(480)
  })

  it('is zero for no sales', () => {
    expect(sumCogs([])).toBe(0)
  })

  it('mixes known and unknown costs correctly', () => {
    const total = sumCogs([
      loose({ quantity: 1, lineTotal: 100, costPrice: 60 }), // 60
      loose({ quantity: 1, lineTotal: 100, costPrice: null }), // 100
    ])
    expect(total).toBe(160)
  })

  it('rounds to paisa', () => {
    expect(sumCogs([loose({ quantity: 3, costPrice: 33.333 })])).toBe(100)
  })

  it('mixes loose and pack lines', () => {
    const total = sumCogs([
      loose({ quantity: 3, costPrice: 80, unitsPerItem: 1 }), // 240
      loose({ quantity: 2, costPrice: 80, unitsPerItem: 12 }), // 1920
    ])
    expect(total).toBe(2160)
  })
})

describe('cost coverage, so a shop is told why its profit looks low', () => {
  it('reports nothing missing when every product has a cost', () => {
    const c = summariseCostCoverage([loose(), loose()])
    expect(c.linesMissingCost).toBe(0)
    expect(c.shareMissingCost).toBe(0)
  })

  it('counts the lines and the revenue with no cost behind them', () => {
    const c = summariseCostCoverage([
      loose({ lineTotal: 800, costPrice: 500 }),
      loose({ lineTotal: 200, costPrice: null }),
    ])
    expect(c.linesMissingCost).toBe(1)
    expect(c.revenueMissingCost).toBe(200)
    expect(c.shareMissingCost).toBeCloseTo(0.2, 5)
  })

  it('reports the whole period when nothing has a cost', () => {
    const c = summariseCostCoverage([loose({ costPrice: null }), loose({ costPrice: null })])
    expect(c.shareMissingCost).toBe(1)
  })

  it('does not divide by zero on a day with no sales', () => {
    expect(summariseCostCoverage([]).shareMissingCost).toBe(0)
  })
})

describe('a real shop shape', () => {
  it('reports the margin only on what it can actually cost', () => {
    // Mirrors ROSE MART: most lines costed, a meaningful slice with no cost price at all.
    const lines: CogsLine[] = [
      ...Array.from({ length: 8 }, () => loose({ quantity: 1, lineTotal: 100, costPrice: 88 })),
      ...Array.from({ length: 2 }, () => loose({ quantity: 1, lineTotal: 100, costPrice: null })),
    ]
    const revenue = 1000
    const profit = revenue - sumCogs(lines)
    // 8 lines make 12 profit; the other 2 are forced to zero.
    expect(profit).toBe(96)
    // And the report can now say WHY: a fifth of revenue was uncostable.
    expect(summariseCostCoverage(lines).shareMissingCost).toBeCloseTo(0.2, 5)
  })
})
