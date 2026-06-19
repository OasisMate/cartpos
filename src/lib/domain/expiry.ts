import { prisma } from '@/lib/db/prisma'

export interface ExpiryLot {
  id: string
  productId: string
  productName: string
  unit: string
  lotNo: string | null
  expiry: string // ISO date
  quantity: number
  status: 'EXPIRED' | 'EXPIRING'
  daysLeft: number // negative when already expired
}

/**
 * Lots that are expired or expiring within `withinDays`, for batch/expiry shops.
 * Only counts lots that still hold stock (quantity > 0). Earliest expiry first.
 */
export async function getExpiringLots(
  shopId: string,
  withinDays: number = 60
): Promise<{ expired: ExpiryLot[]; expiring: ExpiryLot[] }> {
  const now = new Date()
  const horizon = new Date(now.getTime() + withinDays * 24 * 60 * 60 * 1000)

  const lots = await prisma.stockLot.findMany({
    where: {
      shopId,
      quantity: { gt: 0 },
      expiry: { not: null, lte: horizon },
    },
    orderBy: { expiry: 'asc' },
    include: { product: { select: { name: true, unit: true } } },
  })

  const expired: ExpiryLot[] = []
  const expiring: ExpiryLot[] = []
  for (const lot of lots) {
    const exp = lot.expiry as Date
    const daysLeft = Math.floor((exp.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
    const row: ExpiryLot = {
      id: lot.id,
      productId: lot.productId,
      productName: lot.product.name,
      unit: lot.product.unit,
      lotNo: lot.lotNo,
      expiry: exp.toISOString().slice(0, 10),
      quantity: Number(lot.quantity),
      status: daysLeft < 0 ? 'EXPIRED' : 'EXPIRING',
      daysLeft,
    }
    if (daysLeft < 0) expired.push(row)
    else expiring.push(row)
  }
  return { expired, expiring }
}
