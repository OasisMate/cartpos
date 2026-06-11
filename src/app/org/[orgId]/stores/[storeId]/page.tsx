import { prisma } from '@/lib/db/prisma'
import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getShopTimezone } from '@/lib/db/shop-timezone'
import { getManagerDashboard, getCashierDashboard } from '@/lib/domain/dashboard'
import { ManagerDashboard } from '@/components/dashboard/ManagerDashboard'
import { CashierDashboard } from '@/components/dashboard/CashierDashboard'

export default async function OrgStoreDashboardPage({
  params,
}: {
  params: { orgId: string; storeId: string }
}) {
  const user = await getCurrentUser()
  if (!user) {
    redirect('/login')
  }

  const { orgId, storeId } = params

  // Verify store belongs to org
  const store = await prisma.shop.findUnique({
    where: { id: storeId },
    select: { orgId: true, name: true },
  })

  if (!store || store.orgId !== orgId) {
    redirect(`/org/${orgId}/stores`)
  }

  const isPlatformAdmin = user.role === 'PLATFORM_ADMIN'
  const isOrgAdmin = user.organizations?.some(
    (o: any) => o.orgId === orgId && o.orgRole === 'ORG_ADMIN'
  )
  const shopRole = user.shops?.find((s: any) => s.shopId === storeId)?.shopRole

  if (!isPlatformAdmin && !isOrgAdmin && !shopRole) {
    redirect('/')
  }

  const timezone = await getShopTimezone(storeId)
  const basePath = `/org/${orgId}/stores/${storeId}`

  // Cashiers get the lean operational view; managers/admins get the full insight dashboard.
  // Mirrors the role split on /store so there is one dashboard, never a copy.
  if (shopRole === 'CASHIER' && !isOrgAdmin && !isPlatformAdmin) {
    const data = await getCashierDashboard(storeId, timezone)
    return <CashierDashboard shopName={store.name} data={data} basePath={basePath} />
  }

  const data = await getManagerDashboard(storeId, timezone)
  return <ManagerDashboard shopName={store.name} data={data} basePath={basePath} />
}
