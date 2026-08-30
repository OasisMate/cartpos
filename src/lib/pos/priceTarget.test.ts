import { describe, it, expect } from 'vitest'
import { resolvePriceTarget, savedPriceFor } from './priceTarget'

/**
 * A cart line can be priced from four different product fields. Saving an edited price back
 * to the product has to land on the one the line actually came from, or the POS quietly
 * rewrites a rate nobody was looking at (e.g. changing retail while selling to a contractor).
 * The order below mirrors the price selection in addToCart.
 */

describe('resolvePriceTarget', () => {
  it('writes retail price for a plain line in retail mode', () => {
    expect(resolvePriceTarget({}, 'RETAIL')).toEqual({ field: 'price', label: 'retail' })
  })

  it('writes trade price for a plain line in trade mode', () => {
    expect(resolvePriceTarget({}, 'TRADE')).toEqual({ field: 'tradePrice', label: 'trade' })
  })

  it('writes carton price for a carton line', () => {
    expect(resolvePriceTarget({ isCarton: true }, 'RETAIL')).toEqual({
      field: 'cartonPrice',
      label: 'carton',
    })
  })

  it('keeps a carton line on carton price even in trade mode', () => {
    // A carton is a packaging choice, not a customer type: trade mode must not divert it
    // to tradePrice, which is a per-base-unit rate.
    expect(resolvePriceTarget({ isCarton: true }, 'TRADE')).toEqual({
      field: 'cartonPrice',
      label: 'carton',
    })
  })

  it('writes the packaging level price for a level line, and labels it by name', () => {
    expect(resolvePriceTarget({ packName: 'Box' }, 'RETAIL')).toEqual({
      field: 'packLevel',
      packName: 'Box',
      label: 'Box',
    })
  })

  it('prefers the rate recorded on the line over the current price mode', () => {
    // The cashier can toggle retail/trade mid-sale (Alt+T). A line added at retail must keep
    // pointing at retail, or saving its price would quietly rewrite the trade rate instead.
    expect(resolvePriceTarget({ priceField: 'price' }, 'TRADE')).toEqual({ field: 'price', label: 'retail' })
    expect(resolvePriceTarget({ priceField: 'tradePrice' }, 'RETAIL')).toEqual({ field: 'tradePrice', label: 'trade' })
  })

  it('falls back to the current mode for a line with no recorded rate', () => {
    // Lines restored from a held sale or an edited invoice predate the recorded field.
    expect(resolvePriceTarget({}, 'TRADE')).toEqual({ field: 'tradePrice', label: 'trade' })
  })

  it('lets a packaging level win over the legacy carton flag and over trade mode', () => {
    expect(resolvePriceTarget({ packName: 'Strip', isCarton: true }, 'TRADE')).toEqual({
      field: 'packLevel',
      packName: 'Strip',
      label: 'Strip',
    })
  })
})

describe('savedPriceFor', () => {
  const product = {
    price: 100,
    tradePrice: 90,
    cartonPrice: 1150,
    packagingLevels: [
      { name: 'Box', price: 560 },
      { name: 'Strip', price: null },
    ],
  }

  it('reads the rate matching each target', () => {
    expect(savedPriceFor(product, { field: 'price', label: 'retail' })).toBe(100)
    expect(savedPriceFor(product, { field: 'tradePrice', label: 'trade' })).toBe(90)
    expect(savedPriceFor(product, { field: 'cartonPrice', label: 'carton' })).toBe(1150)
    expect(savedPriceFor(product, { field: 'packLevel', packName: 'Box', label: 'Box' })).toBe(560)
  })

  it('returns null where no rate is stored yet', () => {
    // These are the derived cases: no trade rate means retail is used, and a carton with no
    // carton price falls back to price x cartonSize. Saving one establishes it for the first
    // time, so the UI must not treat "nothing stored" as "same as what I typed".
    expect(savedPriceFor({ price: 100 }, { field: 'tradePrice', label: 'trade' })).toBeNull()
    expect(savedPriceFor({ price: 100 }, { field: 'cartonPrice', label: 'carton' })).toBeNull()
    expect(savedPriceFor(product, { field: 'packLevel', packName: 'Strip', label: 'Strip' })).toBeNull()
  })

  it('returns null for a packaging level the product does not have', () => {
    expect(savedPriceFor(product, { field: 'packLevel', packName: 'Pallet', label: 'Pallet' })).toBeNull()
  })
})
