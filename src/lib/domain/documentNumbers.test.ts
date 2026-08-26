import { describe, it, expect, vi } from 'vitest'
import {
  nextDocumentNumber,
  reserveDocumentNumbers,
  formatInvoiceNumber,
  formatQuotationNumber,
  MAX_RESERVATION,
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

describe('reserveDocumentNumbers', () => {
  function fakeTx(rows: Array<{ value: number }>) {
    return { $queryRaw: vi.fn().mockResolvedValue(rows) } as any
  }

  it('derives the block from the counter value after the increment', async () => {
    // Counter was 7253; reserving 50 leaves it at 7303, so the block is 7254..7303.
    const tx = fakeTx([{ value: 7303 }])
    await expect(reserveDocumentNumbers(tx, 'shop_1', 'INVOICE', 50)).resolves.toEqual({
      start: 7254,
      end: 7303,
    })
  })

  it('reserves exactly the count asked for', async () => {
    const tx = fakeTx([{ value: 100 }])
    const { start, end } = await reserveDocumentNumbers(tx, 'shop_1', 'INVOICE', 25)
    expect(end - start + 1).toBe(25)
  })

  it('handles a block of one', async () => {
    const tx = fakeTx([{ value: 9 }])
    await expect(reserveDocumentNumbers(tx, 'shop_1', 'INVOICE', 1)).resolves.toEqual({
      start: 9,
      end: 9,
    })
  })

  it('gives consecutive devices non-overlapping ranges', async () => {
    // Same counter row, two sequential reservations of 50.
    const a = await reserveDocumentNumbers(fakeTx([{ value: 50 }]), 's', 'INVOICE', 50)
    const b = await reserveDocumentNumbers(fakeTx([{ value: 100 }]), 's', 'INVOICE', 50)
    expect(a).toEqual({ start: 1, end: 50 })
    expect(b).toEqual({ start: 51, end: 100 })
    expect(a.end).toBeLessThan(b.start)
  })

  it('allocates in one statement, so two devices cannot be given the same range', async () => {
    const tx = fakeTx([{ value: 50 }])
    await reserveDocumentNumbers(tx, 'shop_1', 'INVOICE', 50)
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1)
  })

  it.each([0, -1, 1.5, NaN, MAX_RESERVATION + 1])('rejects a count of %s', async (count) => {
    await expect(
      reserveDocumentNumbers(fakeTx([{ value: 1 }]), 'shop_1', 'INVOICE', count as number)
    ).rejects.toThrow(/between 1 and/)
  })

  it('throws rather than returning a bogus block when the counter returns nothing', async () => {
    await expect(
      reserveDocumentNumbers(fakeTx([]), 'shop_1', 'INVOICE', 10)
    ).rejects.toThrow(/could not reserve/i)
  })
})
