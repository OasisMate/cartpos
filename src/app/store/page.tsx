// Redirect /store to /shop (using shop internally but exposing store in URL)
import { prisma } from '@/lib/db/prisma'
import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getProductStockBatch } from '@/lib/domain/purchases'
import { getShopTimezone } from '@/lib/db/shop-timezone'
import { shopDayStartUTC } from '@/lib/utils/timezone'
import { DashboardContent } from './_components/DashboardContent'

export default async function StoreDashboardPage() {
  const user = await getCurrentUser()
  if (!user) {
    redirect('/login')
  }

  const shopId = user.currentShopId
  if (!shopId) {
    redirect('/')
  }

  const isPlatform = user.role === 'PLATFORM_ADMIN'
  const isOrgAdmin = user.organizations?.some((o: any) => o.orgId === user.currentOrgId && o.orgRole === 'ORG_ADMIN')
  const shopRole = user.shops?.find((s: any) => s.shopId === shopId)?.shopRole
  const isCashier = user.shops?.some((s: any) => s.shopId === shopId && s.shopRole === 'CASHIER')

  if (!isPlatform && !isOrgAdmin && !shopRole && !isCashier) {
    redirect('/')
  }

  if (!isPlatform) {
    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      select: { orgId: true },
    })
    if (shop?.orgId) {
      const org = await prisma.organization.findUnique({
        where: { id: shop.orgId },
        select: { status: true },
      })
      if (org?.status !== 'ACTIVE') {
        redirect('/waiting-approval')
      }
    }
  }

  // "Today" in the shop's own timezone so the dashboard matches what the
  // shopkeeper considers today (and agrees with Reports).
  const today = shopDayStartUTC(await getShopTimezone(shopId))

  const [shop, invoicesToday, paymentsToday, udhaarInvoicesToday, trackedProducts] = await Promise.all([
    prisma.shop.findUnique({ where: { id: shopId } }),
    prisma.invoice.count({
      where: { shopId, createdAt: { gte: today }, status: 'COMPLETED' },
    }),
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: { shopId, createdAt: { gte: today } },
    }),
    // Udhaar given today = total of COMPLETED udhaar invoices today.
    // Sourced from invoices (not the ledger) so VOIDed sales are excluded — matches Reports.
    prisma.invoice.aggregate({
      _sum: { total: true },
      where: { shopId, createdAt: { gte: today }, status: 'COMPLETED', paymentStatus: 'UDHAAR' },
    }),
    // Candidates for low-stock: tracked products that have a reorder level set.
    prisma.product.findMany({
      where: { shopId, trackStock: true, reorderLevel: { not: null } },
      select: { id: true, reorderLevel: true },
    }),
  ])

  // Low stock = on-hand quantity at or below the reorder level (not just "has a reorder level").
  const stockMap = await getProductStockBatch(
    shopId,
    trackedProducts.map((p) => p.id)
  )
  const lowStockCount = trackedProducts.filter((p) => {
    const onHand = stockMap.get(p.id) ?? 0
    return p.reorderLevel != null && onHand <= p.reorderLevel
  }).length

  return (
    <DashboardContent
      shopName={shop?.name || 'Store'}
      invoicesToday={invoicesToday}
      paymentsToday={Number(paymentsToday._sum.amount || 0)}
      udhaarCreatedToday={Number(udhaarInvoicesToday._sum.total || 0)}
      lowStockCount={lowStockCount}
    />
  )
}
