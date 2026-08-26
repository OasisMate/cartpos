import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const store = new Map<string, any>()
vi.mock('./indexedDb', () => ({
  getMeta: vi.fn(async (k: string) => store.get(k)),
  setMeta: vi.fn(async (k: string, v: any) => void store.set(k, v)),
}))

import {
  takeInvoiceNumber,
  ensureInvoiceNumbers,
  invoiceNumbersRemaining,
  resetInvoiceNumberCache,
} from './invoiceNumbers'

const SHOP = 'shop_1'
const KEY = `invoiceBlock:${SHOP}`

/** Server hands out blocks off one counter, exactly as reserveDocumentNumbers does. */
function serverWithCounterAt(startValue: number) {
  let counter = startValue
  return vi.fn(async (_url: string, init: any) => {
    const { count } = JSON.parse(init.body)
    counter += count
    return {
      ok: true,
      json: async () => ({ start: counter - count + 1, end: counter, shopId: SHOP }),
    }
  })
}

beforeEach(() => {
  store.clear()
  resetInvoiceNumberCache()
  vi.stubGlobal('fetch', serverWithCounterAt(0))
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('checkout speed rule', () => {
  it('never calls the network to hand out a number', async () => {
    await ensureInvoiceNumbers(SHOP, true)
    const calls = (globalThis.fetch as any).mock.calls.length

    for (let i = 0; i < 10; i++) await takeInvoiceNumber(SHOP, true)

    // Only the background top-up may fetch, never the take itself.
    expect((globalThis.fetch as any).mock.calls.length).toBe(calls)
  })

  it('returns null instead of blocking when the block is spent offline', async () => {
    store.set(KEY, { start: 1, next: 3, end: 2 }) // spent
    resetInvoiceNumberCache()
    await expect(takeInvoiceNumber(SHOP, false)).resolves.toBeNull()
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('completes a sale immediately when dry and online, refilling in the background', async () => {
    store.set(KEY, { start: 1, next: 3, end: 2 })
    resetInvoiceNumberCache()
    await expect(takeInvoiceNumber(SHOP, true)).resolves.toBeNull()
    // Refill was kicked off but the sale was not made to wait for it.
    expect(globalThis.fetch).toHaveBeenCalled()
  })
})

describe('handing out numbers', () => {
  it('issues consecutive numbers from the reserved block', async () => {
    await ensureInvoiceNumbers(SHOP, true)
    const a = await takeInvoiceNumber(SHOP, true)
    const b = await takeInvoiceNumber(SHOP, true)
    const c = await takeInvoiceNumber(SHOP, true)
    expect([a?.value, b?.value, c?.value]).toEqual([1, 2, 3])
    expect(a?.formatted).toBe('000001')
  })

  it('never issues the same number twice, even across a page reload', async () => {
    await ensureInvoiceNumbers(SHOP, true)
    const first = await takeInvoiceNumber(SHOP, true)
    resetInvoiceNumberCache() // simulate reload: memory gone, IndexedDB kept
    const second = await takeInvoiceNumber(SHOP, true)
    expect(second?.value).toBe((first?.value ?? 0) + 1)
  })

  it('continues the shop sequence rather than restarting at 1', async () => {
    vi.stubGlobal('fetch', serverWithCounterAt(7253)) // ROSE MART's real position
    await ensureInvoiceNumbers(SHOP, true)
    const next = await takeInvoiceNumber(SHOP, true)
    expect(next?.formatted).toBe('007254')
  })

  it('keeps issuing while offline from an already-reserved block', async () => {
    await ensureInvoiceNumbers(SHOP, true)
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))
    const a = await takeInvoiceNumber(SHOP, false)
    const b = await takeInvoiceNumber(SHOP, false)
    expect([a?.value, b?.value]).toEqual([1, 2])
  })
})

describe('two devices in one shop', () => {
  it('are given non-overlapping ranges, so printed numbers cannot collide', async () => {
    const server = serverWithCounterAt(0)
    vi.stubGlobal('fetch', server)

    // Device A
    await ensureInvoiceNumbers(SHOP, true)
    const aNums: number[] = []
    for (let i = 0; i < 5; i++) aNums.push((await takeInvoiceNumber(SHOP, true))!.value)

    // Device B: its own storage and memory, same server counter.
    store.clear()
    resetInvoiceNumberCache()
    await ensureInvoiceNumbers(SHOP, true)
    const bNums: number[] = []
    for (let i = 0; i < 5; i++) bNums.push((await takeInvoiceNumber(SHOP, true))!.value)

    expect(new Set([...aNums, ...bNums]).size).toBe(10)
    expect(Math.max(...aNums)).toBeLessThan(Math.min(...bNums))
  })
})

describe('ensureInvoiceNumbers', () => {
  it('does nothing while the block is still healthy', async () => {
    await ensureInvoiceNumbers(SHOP, true)
    const after = (globalThis.fetch as any).mock.calls.length
    await ensureInvoiceNumbers(SHOP, true)
    expect((globalThis.fetch as any).mock.calls.length).toBe(after)
  })

  it('does not fetch while offline', async () => {
    await ensureInvoiceNumbers(SHOP, false)
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('leaves the device with numbers it can use offline', async () => {
    await ensureInvoiceNumbers(SHOP, true)
    expect(await invoiceNumbersRemaining(SHOP)).toBeGreaterThan(0)
  })

  it('survives a server error without losing the current block', async () => {
    await ensureInvoiceNumbers(SHOP, true)
    const before = await invoiceNumbersRemaining(SHOP)
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({}) })))
    await ensureInvoiceNumbers(SHOP, true)
    expect(await invoiceNumbersRemaining(SHOP)).toBe(before)
  })

  it('ignores a reply for a different shop, e.g. after switching shops', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ start: 1, end: 50, shopId: 'other_shop' }),
    })))
    await ensureInvoiceNumbers(SHOP, true)
    expect(await invoiceNumbersRemaining(SHOP)).toBe(0)
  })
})
