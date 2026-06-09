// Redirect /store to /shop (using shop internally but exposing store in URL)
import { prisma } from '@/lib/db/prisma'
import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getProductStockBatch } from '@/lib/domain/purchases'
import { shopDayStartUTC, DEFAULT_TIMEZONE } from '@/lib/utils/timezone'
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

  // One round-trip: shop name + org status (for the access gate) + timezone.
  // Folding these together (instead of 3 sequential queries) matters a lot
  // because the DB is cross-region from the function.
  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    select: {
      name: true,
      organization: { select: { status: true } },
      settings: { select: { timezone: true } },
    },
  })

  if (!isPlatform && shop?.organization && shop.organization.status !== 'ACTIVE') {
    redirect('/waiting-approval')
  }

  // "Today" in the shop's own timezone so the dashboard matches what the
  // shopkeeper considers today (and agrees with Reports).
  const today = shopDayStartUTC(shop?.settings?.timezone || DEFAULT_TIMEZONE)

  const [invoicesToday, paymentsToday, udhaarInvoicesToday, trackedProducts] = await Promise.all([
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
