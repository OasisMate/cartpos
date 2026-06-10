import { prisma } from '@/lib/db/prisma'
import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { DEFAULT_TIMEZONE } from '@/lib/utils/timezone'
import {
  getManagerDashboard,
  getCashierDashboard,
  getOrgStoresToday,
} from '@/lib/domain/dashboard'
import { ManagerDashboard } from './_components/ManagerDashboard'
import { CashierDashboard } from './_components/CashierDashboard'

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
  const isOrgAdmin = user.organizations?.some(
    (o: any) => o.orgId === user.currentOrgId && o.orgRole === 'ORG_ADMIN'
  )
  const shopRole = user.shops?.find((s: any) => s.shopId === shopId)?.shopRole
  const isCashier = shopRole === 'CASHIER'

  if (!isPlatform && !isOrgAdmin && !shopRole) {
    redirect('/')
  }

  // Shop name + org status (access gate) + timezone in one round-trip.
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

  const timezone = shop?.settings?.timezone || DEFAULT_TIMEZONE
  const shopName = shop?.name || 'Store'

  // Cashiers get the lean operational view (no profit/receivables/payables).
  if (isCashier && !isOrgAdmin && !isPlatform) {
    const data = await getCashierDashboard(shopId, timezone)
    return <CashierDashboard shopName={shopName} data={data} />
  }

  // Managers / org owners / platform admins get the full insight dashboard.
  const data = await getManagerDashboard(shopId, timezone)
  const orgStores =
    (isOrgAdmin || isPlatform) && user.currentOrgId
      ? await getOrgStoresToday(user.currentOrgId, timezone)
      : undefined

  return <ManagerDashboard shopName={shopName} data={data} orgStores={orgStores} />
}
