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

/** Invoice numbers: 000001, 000002, ... */
export function formatInvoiceNumber(value: number): string {
  return String(value).padStart(6, '0')
}

/** Quotation numbers: Q000001, Q000002, ... */
export function formatQuotationNumber(value: number): string {
  return 'Q' + String(value).padStart(6, '0')
}
