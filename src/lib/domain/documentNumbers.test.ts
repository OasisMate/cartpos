import { describe, it, expect, vi } from 'vitest'
import {
  nextDocumentNumber,
  formatInvoiceNumber,
  formatQuotationNumber,
} from './documentNumbers'

describe('formatInvoiceNumber', () => {
  it('pads to six digits', () => {
    expect(formatInvoiceNumber(1)).toBe('000001')
    expect(formatInvoiceNumber(42)).toBe('000042')
    expect(formatInvoiceNumber(999999)).toBe('999999')
  })

  it('does not truncate once a shop passes six digits', () => {
    expect(formatInvoiceNumber(1000000)).toBe('1000000')
  })

  it('sorts lexically in the same order as numerically, within the padded range', () => {
    const nums = [3, 21, 100, 7].map(formatInvoiceNumber)
    expect([...nums].sort()).toEqual([3, 7, 21, 100].map(formatInvoiceNumber))
  })
})

describe('formatQuotationNumber', () => {
  it('prefixes Q and pads to six digits', () => {
    expect(formatQuotationNumber(1)).toBe('Q000001')
    expect(formatQuotationNumber(1234)).toBe('Q001234')
  })

  it('stays distinguishable from an invoice number', () => {
    expect(formatQuotationNumber(5)).not.toBe(formatInvoiceNumber(5))
  })
})

describe('nextDocumentNumber', () => {
  function fakeTx(rows: Array<{ value: number }>) {
    return { $queryRaw: vi.fn().mockResolvedValue(rows) } as any
  }

  it('returns the value the counter handed back', async () => {
    const tx = fakeTx([{ value: 7 }])
    await expect(nextDocumentNumber(tx, 'shop_1', 'INVOICE')).resolves.toBe(7)
  })

  it('allocates in a single statement, so concurrent callers cannot collide', async () => {
    const tx = fakeTx([{ value: 1 }])
    await nextDocumentNumber(tx, 'shop_1', 'INVOICE')
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1)
  })

  it('runs on the caller transaction, so a failed sale does not burn a number', async () => {
    const tx = fakeTx([{ value: 3 }])
    await nextDocumentNumber(tx, 'shop_1', 'QUOTATION')
    // The statement was issued through the passed-in tx client, not a fresh connection.
    expect(tx.$queryRaw).toHaveBeenCalled()
  })

  it('throws rather than numbering a document 0 when the counter returns nothing', async () => {
    await expect(nextDocumentNumber(fakeTx([]), 'shop_1', 'INVOICE')).rejects.toThrow(
      /could not allocate/i
    )
  })

  it('throws when the counter returns a non-finite value', async () => {
    const tx = fakeTx([{ value: NaN }])
    await expect(nextDocumentNumber(tx, 'shop_1', 'INVOICE')).rejects.toThrow(
      /could not allocate/i
    )
  })
})
