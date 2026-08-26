import { describe, it, expect } from 'vitest'
import { returnLineKey } from './returns'
import { lineCogs } from './cogs'

/**
 * Returns move stock and money in the opposite direction to a sale, so the same pack rules have
 * to hold. Returning one carton of twelve must put twelve units back on the shelf and reverse
 * the cost of twelve, not of one.
 */

describe('returnable row identity', () => {
  it('separates the same product sold in different packagings', () => {
    // The same sugar sold loose and by the carton is two entitlements at two prices. Keying on
    // the product alone merged them, so a carton return could be priced as a loose one.
    expect(returnLineKey('p1', 1)).not.toBe(returnLineKey('p1', 12))
  })

  it('matches rows of the same product and packaging', () => {
    expect(returnLineKey('p1', 12)).toBe(returnLineKey('p1', 12))
  })

  it('separates different products on the same packaging', () => {
    expect(returnLineKey('p1', 12)).not.toBe(returnLineKey('p2', 12))
  })

  it('can be traced back to its product, which the pack fallback relies on', () => {
    expect(returnLineKey('p1', 12).startsWith('p1::')).toBe(true)
  })
})

describe('a returned pack reverses what the sale booked', () => {
  const COST_PER_BASE_UNIT = 80

  it('reverses the cost of every base unit in the carton', () => {
    // Sale: 2 cartons of 12 at cost 80/unit booked 1920 of COGS.
    const sold = lineCogs({
      quantity: 2,
      lineTotal: 2200,
      unitsPerItem: 12,
      costPrice: COST_PER_BASE_UNIT,
    })
    // Return of both cartons must reverse exactly that.
    const returned = lineCogs({
      quantity: 2,
      lineTotal: 2200,
      unitsPerItem: 12,
      costPrice: COST_PER_BASE_UNIT,
    })
    expect(sold).toBe(1920)
    expect(returned).toBe(sold)
  })

  it('reverses only a twelfth if the packaging is lost, which is the bug', () => {
    // What the old code did: no unitsPerItem on the return line, so the carton was costed as
    // one unit and the books kept 1760 of cost for goods sitting back on the shelf.
    const withoutPack = lineCogs({ quantity: 2, lineTotal: 2200, costPrice: COST_PER_BASE_UNIT })
    expect(withoutPack).toBe(160)
    expect(withoutPack).not.toBe(1920)
  })

  it('reverses a partial pack return proportionally', () => {
    const one = lineCogs({ quantity: 1, lineTotal: 1100, unitsPerItem: 12, costPrice: COST_PER_BASE_UNIT })
    expect(one).toBe(960)
  })

  it('is unchanged for a loose return', () => {
    expect(lineCogs({ quantity: 3, lineTotal: 300, unitsPerItem: 1, costPrice: COST_PER_BASE_UNIT })).toBe(240)
  })

  it('falls back to sale value when the product has no cost, as on the sale side', () => {
    expect(lineCogs({ quantity: 2, lineTotal: 2200, unitsPerItem: 12, costPrice: null })).toBe(2200)
  })
})

describe('base units restocked', () => {
  // Mirrors the stock-ledger arithmetic in createReturn.
  const baseUnits = (quantity: number, unitsPerItem: number) => {
    const per = Number(unitsPerItem)
    return quantity * (Number.isFinite(per) && per > 0 ? per : 1)
  }

  it('puts a whole carton back on the shelf', () => {
    expect(baseUnits(1, 12)).toBe(12)
  })

  it('puts back loose units unchanged', () => {
    expect(baseUnits(3, 1)).toBe(3)
  })

  it.each([0, -1, NaN, undefined as any])('treats %s packaging as loose', (per) => {
    expect(baseUnits(3, per)).toBe(3)
  })

  it('handles a decimal quantity of a pack', () => {
    expect(baseUnits(2.5, 12)).toBe(30)
  })
})
