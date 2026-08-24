import { describe, it, expect } from 'vitest'
import { buildListShareText } from './shareText'

const date = new Date('2026-08-24T10:00:00Z')

describe('buildListShareText', () => {
  it('numbers the items and shows the unit', () => {
    const text = buildListShareText({
      shopName: 'ALSYED MART',
      listName: 'Friday order',
      supplierName: 'Ali Traders',
      date,
      lines: [
        { name: 'LAYS MASALA', quantity: 5, unit: 'pcs' },
        { name: 'PEPSI 1.5L', quantity: 2, unit: 'ctn' },
      ],
    })
    expect(text).toContain('ALSYED MART')
    expect(text).toContain('Purchase List: Friday order')
    expect(text).toContain('Supplier: Ali Traders')
    expect(text).toContain('24/08/2026')
    expect(text).toContain('1. LAYS MASALA - 5 pcs')
    expect(text).toContain('2. PEPSI 1.5L - 2 ctn')
    expect(text).toContain('Total items: 2')
  })

  it('never leaks a price', () => {
    const text = buildListShareText({
      shopName: 'ALSYED MART',
      date,
      lines: [{ name: 'LAYS MASALA', quantity: 5, unit: 'pcs' }],
    })
    expect(text).not.toMatch(/Rs|price|total:/i)
  })

  it('drops the optional header lines when they are missing', () => {
    const text = buildListShareText({ shopName: 'SHOP', date, lines: [] })
    expect(text).toContain('Purchase List')
    expect(text).not.toContain('Supplier:')
    expect(text).toContain('Total items: 0')
  })

  it('trims trailing zeros off a decimal quantity', () => {
    const text = buildListShareText({
      shopName: 'SHOP',
      date,
      lines: [{ name: 'SUGAR', quantity: 2.5, unit: 'kg' }],
    })
    expect(text).toContain('1. SUGAR - 2.5 kg')
  })
})
