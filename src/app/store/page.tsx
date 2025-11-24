// Redirect /store to /shop (using shop internally but exposing store in URL)
import { prisma } from '@/lib/db/prisma'
import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
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

  const today = new Date(new Date().toDateString())

  const [shop, invoicesToday, paymentsToday, udhaarCreatedToday, lowStockCount] = await Promise.all([
    prisma.shop.findUnique({ where: { id: shopId } }),
    prisma.invoice.count({
      where: { shopId, createdAt: { gte: today }, status: 'COMPLETED' },
    }),
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: { shopId, createdAt: { gte: today } },
    }),
    prisma.customerLedger.aggregate({
      _sum: { amount: true },
      where: { shopId, createdAt: { gte: today }, type: 'SALE_UDHAAR', direction: 'DEBIT' },
    }),
    prisma.product.count({
      where: {
        shopId,
        trackStock: true,
        reorderLevel: { not: null },
      },
    }),
  ])

  return (
    <DashboardContent
      shopName={shop?.name || 'Store'}
      invoicesToday={invoicesToday}
      paymentsToday={Number(paymentsToday._sum.amount || 0)}
      udhaarCreatedToday={Number(udhaarCreatedToday._sum.amount || 0)}
      lowStockCount={lowStockCount}
    />
  )
}
