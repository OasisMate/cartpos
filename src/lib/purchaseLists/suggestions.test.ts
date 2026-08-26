import { describe, it, expect } from 'vitest'
import { rankSuggestions } from './suggestions'

describe('rankSuggestions', () => {
  it('puts low stock before recent sellers', () => {
    const out = rankSuggestions({
      lowStock: [{ productId: 'a', onHand: 1, reorderLevel: 10 }],
      sold: [{ productId: 'b', baseUnitsSold: 500 }],
    })
    expect(out.map((s) => s.productId)).toEqual(['a', 'b'])
    expect(out[0]).toEqual({ productId: 'a', reason: 'LOW_STOCK', shortfall: 9 })
    expect(out[1]).toEqual({ productId: 'b', reason: 'SOLD_RECENTLY', baseUnitsSold: 500 })
  })

  it('sorts low stock by shortfall, biggest first', () => {
    const out = rankSuggestions({
      lowStock: [
        { productId: 'small', onHand: 8, reorderLevel: 10 },
        { productId: 'big', onHand: 0, reorderLevel: 20 },
      ],
      sold: [],
    })
    expect(out.map((s) => s.productId)).toEqual(['big', 'small'])
  })

  it('lists a product once when it is both low and selling', () => {
    const out = rankSuggestions({
      lowStock: [{ productId: 'a', onHand: 0, reorderLevel: 5 }],
      sold: [{ productId: 'a', baseUnitsSold: 99 }],
    })
    expect(out).toHaveLength(1)
    expect(out[0].reason).toBe('LOW_STOCK')
  })

  it('drops products already on the list', () => {
    const out = rankSuggestions({
      lowStock: [{ productId: 'a', onHand: 0, reorderLevel: 5 }],
      sold: [{ productId: 'b', baseUnitsSold: 10 }],
      excludeProductIds: ['a', 'b'],
    })
    expect(out).toEqual([])
  })

  it('ignores products that are not actually below their reorder level', () => {
    const out = rankSuggestions({
      lowStock: [
        { productId: 'fine', onHand: 50, reorderLevel: 10 },
        { productId: 'untracked', onHand: 0, reorderLevel: 0 },
      ],
      sold: [],
    })
    expect(out).toEqual([])
  })

  it('treats onHand equal to reorderLevel as low stock, with zero shortfall', () => {
    const out = rankSuggestions({
      lowStock: [{ productId: 'a', onHand: 10, reorderLevel: 10 }],
      sold: [],
    })
    expect(out).toEqual([{ productId: 'a', reason: 'LOW_STOCK', shortfall: 0 }])
  })

  it('caps the result at the limit', () => {
    const out = rankSuggestions({
      lowStock: [],
      sold: [
        { productId: 'a', baseUnitsSold: 3 },
        { productId: 'b', baseUnitsSold: 2 },
        { productId: 'c', baseUnitsSold: 1 },
      ],
      limit: 2,
    })
    expect(out.map((s) => s.productId)).toEqual(['a', 'b'])
  })

  it('caps the combined result at the limit, filling with low stock first', () => {
    const out = rankSuggestions({
      lowStock: [
        { productId: 'a', onHand: 0, reorderLevel: 5 },
        { productId: 'b', onHand: 0, reorderLevel: 3 },
      ],
      sold: [
        { productId: 'x', baseUnitsSold: 100 },
        { productId: 'y', baseUnitsSold: 50 },
      ],
      limit: 3,
    })
    expect(out.map((s) => s.productId)).toEqual(['a', 'b', 'x'])
    expect(out[2]).toEqual({ productId: 'x', reason: 'SOLD_RECENTLY', baseUnitsSold: 100 })
  })

  it('breaks ties by product id so the order is stable', () => {
    const out = rankSuggestions({
      lowStock: [],
      sold: [
        { productId: 'z', baseUnitsSold: 5 },
        { productId: 'a', baseUnitsSold: 5 },
      ],
    })
    expect(out.map((s) => s.productId)).toEqual(['a', 'z'])
  })

  it('breaks low stock ties by product id too', () => {
    const out = rankSuggestions({
      lowStock: [
        { productId: 'z', onHand: 0, reorderLevel: 5 },
        { productId: 'a', onHand: 0, reorderLevel: 5 },
      ],
      sold: [],
    })
    expect(out.map((s) => s.productId)).toEqual(['a', 'z'])
  })
})
