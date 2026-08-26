import { Prisma } from '@prisma/client'

/**
 * Hands out the next running document number for a shop.
 *
 * The old approach read MAX(number) for the shop, added one, and inserted. Under Postgres
 * READ COMMITTED two concurrent transactions both read the same max and both wrote the same
 * number, so two cashiers ringing up at once - or two devices flushing their offline queues -
 * produced duplicate invoice numbers. It also reused a number whenever the newest invoice was
 * deleted.
 *
 * This is a single atomic statement: INSERT .. ON CONFLICT DO UPDATE .. RETURNING. The row
 * lock Postgres takes on conflict serialises callers within a shop, and because it runs inside
 * the caller's transaction the increment rolls back with the rest if the sale fails, so a
 * failed sale does not burn a number.
 */
export type DocumentCounterKind = 'INVOICE' | 'QUOTATION'

/** Anything exposing $queryRaw: the Prisma client itself or a transaction client. */
type PrismaLike = { $queryRaw: Prisma.TransactionClient['$queryRaw'] }

/**
 * Ceiling on one reservation. A device only needs enough to survive a day offline; a large
 * request would burn numbers and widen the gaps for everyone else in the shop.
 */
export const MAX_RESERVATION = 500

export async function nextDocumentNumber(
  tx: Prisma.TransactionClient,
  shopId: string,
  kind: DocumentCounterKind
): Promise<number> {
  const rows = await tx.$queryRaw<Array<{ value: number }>>`
    INSERT INTO "ShopCounter" ("shopId", "kind", "value")
    VALUES (${shopId}, ${kind}::"DocumentCounter", 1)
    ON CONFLICT ("shopId", "kind")
    DO UPDATE SET "value" = "ShopCounter"."value" + 1
    RETURNING "value"
  `
  const value = rows[0]?.value
  if (!value || !Number.isFinite(value)) {
    throw new Error(`Could not allocate a ${kind.toLowerCase()} number`)
  }
  return value
}


/**
 * Reserve a contiguous block of numbers for one device, in a single atomic statement.
 *
 * This is what keeps the number a cashier sees on the printed receipt identical to the one
 * stored in the database. The POS is offline-first: it prints before the sale reaches the
 * server, so the number has to be decided on the device. A device claims a block while it is
 * online and then hands numbers out locally, online or offline. Because the block is carved
 * off the same counter row under the same row lock, two devices can never be given
 * overlapping ranges.
 *
 * Unused numbers in a block become gaps. That is intended: a ledger may skip a number, it may
 * never repeat one.
 */
export async function reserveDocumentNumbers(
  client: Prisma.TransactionClient | PrismaLike,
  shopId: string,
  kind: DocumentCounterKind,
  count: number
): Promise<{ start: number; end: number }> {
  if (!Number.isInteger(count) || count < 1 || count > MAX_RESERVATION) {
    throw new Error(`Reservation size must be between 1 and ${MAX_RESERVATION}`)
  }

  const rows = await client.$queryRaw<Array<{ value: number }>>`
    INSERT INTO "ShopCounter" ("shopId", "kind", "value")
    VALUES (${shopId}, ${kind}::"DocumentCounter", ${count})
    ON CONFLICT ("shopId", "kind")
    DO UPDATE SET "value" = "ShopCounter"."value" + ${count}
    RETURNING "value"
  `
  const end = rows[0]?.value
  if (!end || !Number.isFinite(end)) {
    throw new Error(`Could not reserve ${kind.toLowerCase()} numbers`)
  }
  // The counter now points at the LAST number in the block.
  return { start: end - count + 1, end }
}

/** Invoice numbers: 000001, 000002, ... */
export function formatInvoiceNumber(value: number): string {
  return String(value).padStart(6, '0')
}

/** Quotation numbers: Q000001, Q000002, ... */
export function formatQuotationNumber(value: number): string {
  return 'Q' + String(value).padStart(6, '0')
}
