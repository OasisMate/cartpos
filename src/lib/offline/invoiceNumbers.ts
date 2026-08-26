import { getMeta, setMeta } from './indexedDb'
import { formatInvoiceNumber } from '@/lib/domain/documentNumbers'

/**
 * Invoice numbers for the POS, assigned on the device.
 *
 * The POS prints the receipt before the sale reaches the server, so the number has to be known
 * at ring-up. It used to be invented from a localStorage counter that had nothing to do with the
 * database, so the paper the customer walked out with never matched the invoice, and two devices
 * in one shop both printed 000001, 000002, ...
 *
 * Instead the device reserves a block from the shop's counter while it is online and hands the
 * numbers out locally. The same number is printed and sent to the server, online or offline, so
 * the two can no longer disagree. Blocks are carved off one counter row under a row lock, so no
 * two devices are ever given the same number.
 *
 * SPEED RULE: checkout must never wait on the network for a number.
 * `takeInvoiceNumber` therefore does no fetching at all - it reads from memory and writes one
 * IndexedDB record. Blocks are refilled ahead of time by `ensureInvoiceNumbers` (on POS open,
 * on reconnect) and by a background top-up once the block runs low. If a device somehow still
 * runs dry, the sale completes immediately as PENDING rather than blocking the counter.
 */

/** How many numbers to claim at a time. Enough for a full day offline without burning many. */
const BLOCK_SIZE = 50
/** Refill once the block runs this low, so a shop realistically never reaches empty. */
const TOP_UP_AT = 15

interface InvoiceBlock {
  /** First number in the reserved range. */
  start: number
  /** Next number to hand out. Past `end` means the block is spent. */
  next: number
  /** Last number in the reserved range, inclusive. */
  end: number
}

const keyFor = (shopId: string) => `invoiceBlock:${shopId}`

/**
 * In-memory mirror of the stored block, so ring-up costs one IndexedDB write instead of a
 * read plus a write. Rebuilt from IndexedDB on first use after a page load.
 */
const cache = new Map<string, InvoiceBlock>()
/** Guards against firing several overlapping reservations for the same shop. */
const inFlight = new Set<string>()

function valid(b: unknown): b is InvoiceBlock {
  if (!b || typeof b !== 'object') return false
  const { start, next, end } = b as InvoiceBlock
  return [start, next, end].every((n) => Number.isInteger(n) && n > 0)
}

async function loadBlock(shopId: string): Promise<InvoiceBlock | null> {
  const cached = cache.get(shopId)
  if (cached) return cached
  const raw = await getMeta(keyFor(shopId))
  if (!valid(raw)) return null
  cache.set(shopId, raw)
  return raw
}

function remaining(block: InvoiceBlock | null): number {
  if (!block) return 0
  return Math.max(0, block.end - block.next + 1)
}

/**
 * Claim a fresh block from the server. Always called in the background, never from checkout.
 * Resolves to null when offline or refused, which simply leaves the current block in place.
 */
async function reserveBlock(shopId: string): Promise<InvoiceBlock | null> {
  if (inFlight.has(shopId)) return null
  inFlight.add(shopId)
  try {
    const res = await fetch('/api/pos/invoice-numbers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ count: BLOCK_SIZE }),
    })
    if (!res.ok) return null
    const data = await res.json()
    if (!Number.isInteger(data?.start) || !Number.isInteger(data?.end)) return null
    // Guard against a stale response landing after the user switched shops.
    if (data.shopId && data.shopId !== shopId) return null

    const current = await loadBlock(shopId)
    // Never discard numbers still unused in the current block: prefer whichever range has more
    // left, so a redundant reservation cannot shrink what this device can issue offline.
    const fresh: InvoiceBlock = { start: data.start, next: data.start, end: data.end }
    const block = remaining(current) > remaining(fresh) ? current! : fresh
    cache.set(shopId, block)
    await setMeta(keyFor(shopId), block)
    return block
  } catch {
    return null
  } finally {
    inFlight.delete(shopId)
  }
}

/**
 * Make sure this device is holding numbers. Call on POS open and on reconnect. Returns
 * immediately when the block is healthy, and never throws.
 */
export async function ensureInvoiceNumbers(shopId: string, isOnline: boolean): Promise<void> {
  if (!shopId || !isOnline) return
  const block = await loadBlock(shopId)
  if (remaining(block) > TOP_UP_AT) return
  await reserveBlock(shopId)
}

/**
 * The number for the sale being rung up right now, consumed from this device's block.
 *
 * Never touches the network, so it cannot slow a checkout down. Returns null when the block is
 * spent, which the caller must treat as "not numbered yet" rather than inventing one: a made-up
 * number is exactly the bug this module exists to remove. The server assigns a real number when
 * the sale syncs.
 */
export async function takeInvoiceNumber(
  shopId: string,
  isOnline: boolean
): Promise<{ value: number; formatted: string } | null> {
  if (!shopId) return null

  const block = await loadBlock(shopId)
  if (remaining(block) === 0) {
    // Dry. Do not block the sale on a fetch; refill for next time and let this one go PENDING.
    if (isOnline) void reserveBlock(shopId)
    return null
  }

  const value = block!.next
  const updated: InvoiceBlock = { ...block!, next: value + 1 }
  cache.set(shopId, updated)
  await setMeta(keyFor(shopId), updated)

  // Refill in the background once we dip low, so no later sale is the one that waits.
  if (isOnline && remaining(updated) <= TOP_UP_AT) void reserveBlock(shopId)

  return { value, formatted: formatInvoiceNumber(value) }
}

/** How many numbers this device can still issue without the network. For diagnostics. */
export async function invoiceNumbersRemaining(shopId: string): Promise<number> {
  return remaining(await loadBlock(shopId))
}

/** Drop the in-memory mirror, e.g. when switching shops. Stored blocks are untouched. */
export function resetInvoiceNumberCache(): void {
  cache.clear()
}
