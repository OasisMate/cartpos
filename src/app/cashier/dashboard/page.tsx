import { prisma } from '@/lib/db/prisma'
import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getProductStockBatch } from '@/lib/domain/purchases'
import { getShopTimezone } from '@/lib/db/shop-timezone'
import { shopDayStartUTC } from '@/lib/utils/timezone'
import CashierDashboardClient from './CashierDashboardClient'

export default async function CashierDashboardPage() {
  const user = await getCurrentUser()
  if (!user) {
    redirect('/login')
  }

  const shopId = user.currentShopId
  if (!shopId) {
    redirect('/')
  }

  // Only cashiers can access this page
  const isCashier = user.shops?.some((s: any) => s.shopId === shopId && s.shopRole === 'CASHIER')
  if (!isCashier && user.role !== 'PLATFORM_ADMIN') {
    redirect('/')
  }

  // Check organization status
  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    select: { orgId: true, name: true },
  })

  if (shop?.orgId && user.role !== 'PLATFORM_ADMIN') {
    const org = await prisma.organization.findUnique({
      where: { id: shop.orgId },
      select: { status: true },
    })
    if (org?.status !== 'ACTIVE') {
      redirect('/waiting-approval')
    }
  }

  const today = shopDayStartUTC(await getShopTimezone(shopId))

  // Get cashier's personal stats
  const [invoices, lowStockCandidates] = await Promise.all([
    prisma.invoice.findMany({
      where: {
        shopId,
        createdByUserId: user.id,
        createdAt: { gte: today },
        status: 'COMPLETED',
      },
      select: {
        total: true,
        paymentStatus: true,
        paymentMethod: true,
      },
    }),
    prisma.product.findMany({
      where: {
        shopId,
        trackStock: true,
        reorderLevel: { not: null },
      },
      select: {
        id: true,
        name: true,
        reorderLevel: true,
      },
    }),
  ])

  // Only keep products whose on-hand quantity is at or below the reorder level.
  const stockMap = await getProductStockBatch(
    shopId,
    lowStockCandidates.map((p) => p.id)
  )
  const lowStockProducts = lowStockCandidates
    .filter((p) => p.reorderLevel != null && (stockMap.get(p.id) ?? 0) <= p.reorderLevel)
    .slice(0, 10)

  const summary = invoices.reduce(
    (acc, inv) => {
      const amount = Number(inv.total)
      acc.totalSales += amount
      acc.invoiceCount += 1

      if (inv.paymentStatus === 'UDHAAR') {
        acc.udhaarSales += amount
      } else if (inv.paymentStatus === 'PAID') {
        if (inv.paymentMethod === 'CASH') acc.cashSales += amount
        else if (inv.paymentMethod === 'CARD') acc.cardSales += amount
        else acc.cashSales += amount // Treat OTHER as Cash for now
      }
      return acc
    },
    { totalSales: 0, cashSales: 0, cardSales: 0, udhaarSales: 0, invoiceCount: 0 }
  )

  return (
    <CashierDashboardClient
      shopName={shop?.name}
      summary={summary}
      lowStockProducts={lowStockProducts}
    />
  )
}
