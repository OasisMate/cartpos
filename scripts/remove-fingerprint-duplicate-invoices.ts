/**
 * Finds "same sale posted twice" invoices: identical shop, lines (product/qty/totals),
 * discount, total, payment type, customer — and created within a short time window.
 * Keeps the oldest in each cluster; deletes the rest (same cleanup as deleteSale).
 *
 * This catches duplicates with DIFFERENT invoice numbers (e.g. 000709 + 000710).
 *
 * Usage:
 *   npm run dedupe-invoices-fingerprint
 *   npm run dedupe-invoices-fingerprint -- --execute
 *   npm run dedupe-invoices-fingerprint -- --execute --shopId=cxxx
 *   npm run dedupe-invoices-fingerprint -- --execute --max-gap-ms=180000
 */

import { PrismaClient } from '@prisma/client'
import type { Decimal } from '@prisma/client/runtime/library'
import { deleteInvoicePhysically } from './lib/deleteInvoicePhysically'

const prisma = new PrismaClient()

type Line = {
  productId: string
  quantity: Decimal
  lineTotal: Decimal
}

type Inv = {
  id: string
  shopId: string
  number: string | null
  customerId: string | null
  paymentStatus: string
  paymentMethod: string | null
  discount: Decimal
  total: Decimal
  createdAt: Date
  lines: Line[]
}

function lineSignature(lines: Line[]): string {
  return [...lines]
    .sort((a, b) => a.productId.localeCompare(b.productId))
    .map((l) => `${l.productId}:${l.quantity.toString()}:${l.lineTotal.toString()}`)
    .join('|')
}

function fingerprint(inv: Inv): string {
  return [
    inv.shopId,
    inv.customerId ?? '',
    inv.paymentStatus,
    inv.paymentMethod ?? '',
    inv.discount.toString(),
    inv.total.toString(),
    lineSignature(inv.lines),
  ].join('::')
}

/** Consecutive invoices at most maxGapMs apart form one cluster */
function clusterByTimeGap(sorted: Inv[], maxGapMs: number): Inv[][] {
  const clusters: Inv[][] = []
  let current: Inv[] = []

  for (const inv of sorted) {
    if (current.length === 0) {
      current = [inv]
      continue
    }
    const last = current[current.length - 1]!
    const gap = inv.createdAt.getTime() - last.createdAt.getTime()
    if (gap <= maxGapMs) {
      current.push(inv)
    } else {
      clusters.push(current)
      current = [inv]
    }
  }
  if (current.length) clusters.push(current)
  return clusters
}

function parseMaxGapMs(): number {
  const arg = process.argv.find((a) => a.startsWith('--max-gap-ms='))
  if (!arg) return 120_000 // 2 minutes default
  const n = parseInt(arg.split('=')[1] || '', 10)
  return Number.isFinite(n) && n > 0 ? n : 120_000
}

async function main() {
  const execute = process.argv.includes('--execute')
  const shopArg = process.argv.find((a) => a.startsWith('--shopId='))
  const onlyShopId = shopArg ? shopArg.split('=')[1]?.trim() : undefined
  const maxGapMs = parseMaxGapMs()

  const invoices = (await prisma.invoice.findMany({
    where: {
      status: 'COMPLETED',
      ...(onlyShopId ? { shopId: onlyShopId } : {}),
    },
    include: {
      lines: {
        select: {
          productId: true,
          quantity: true,
          lineTotal: true,
        },
      },
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  })) as Inv[]

  const byFp = new Map<string, Inv[]>()
  for (const inv of invoices) {
    if (inv.lines.length === 0) continue
    const fp = fingerprint(inv)
    const list = byFp.get(fp) ?? []
    list.push(inv)
    byFp.set(fp, list)
  }

  const toDelete: { inv: Inv; reason: string }[] = []

  for (const [, group] of byFp) {
    if (group.length < 2) continue
    const sorted = [...group].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id)
    )
    const clusters = clusterByTimeGap(sorted, maxGapMs)
    for (const cluster of clusters) {
      if (cluster.length < 2) continue
      const [keeper, ...victims] = cluster
      for (const v of victims) {
        toDelete.push({
          inv: v,
          reason: `dup of ${keeper.id} (#${keeper.number ?? '?'}) within ${maxGapMs}ms chain`,
        })
      }
    }
  }

  if (toDelete.length === 0) {
    console.log('No fingerprint+time-window duplicates found.')
    await prisma.$disconnect()
    return
  }

  console.log(
    execute
      ? `EXECUTE — deleting ${toDelete.length} invoice(s) (max gap ${maxGapMs}ms)…`
      : `DRY RUN — ${toDelete.length} invoice(s) would be deleted. Pass --execute to apply.\n`
  )

  let n = 0
  for (const { inv, reason } of toDelete) {
    console.log(
      `${execute ? 'DELETE' : 'would delete'}  #${inv.number ?? '?'}  ${inv.id}  ${inv.createdAt.toISOString()}  total=${inv.total}  → ${reason}`
    )
    if (execute) {
      await deleteInvoicePhysically(prisma, inv.id, inv.shopId)
      n++
    }
  }

  if (execute) {
    console.log(`\nDone. Removed ${n} duplicate invoice(s).`)
  }

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  prisma.$disconnect()
  process.exit(1)
})
