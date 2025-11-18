import { prisma } from '@/lib/db/prisma'
import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'

export async function renderOrgDashboard(orgIdOverride?: string) {
  const user = await getCurrentUser()
  if (!user) {
    redirect('/login')
  }

  const isPlatformAdmin = user.role === 'PLATFORM_ADMIN'
  const isOrgAdmin =
    user.organizations?.some(
      (o: any) => o.orgRole === 'ORG_ADMIN' && (!orgIdOverride || o.orgId === orgIdOverride)
    ) || false

  const orgId = orgIdOverride || user.currentOrgId || user.organizations?.[0]?.orgId

  if (!orgId) {
    redirect('/')
  }

  if (!isPlatformAdmin && !isOrgAdmin) {
    redirect('/')
  }

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { status: true },
  })

  if (!org || org.status !== 'ACTIVE') {
    redirect('/waiting-approval')
  }

  const [shops, usersInOrg] = await Promise.all([
    prisma.shop.findMany({
      where: { orgId },
      select: { id: true, name: true },
    }),
    prisma.organizationUser.count({ where: { orgId } }),
  ])

  const shopIds = shops.map((s) => s.id)

  const [productsCount, customersCount, invoicesTodayCount, outstandingUdhaar] = await Promise.all([
    prisma.product.count({ where: { shopId: { in: shopIds } } }),
    prisma.customer.count({ where: { shopId: { in: shopIds } } }),
    prisma.invoice.count({
      where: {
        shopId: { in: shopIds },
        createdAt: { gte: new Date(new Date().toDateString()) },
        status: 'COMPLETED',
      },
    }),
    prisma.customerLedger.aggregate({
      _sum: { amount: true },
      where: { shopId: { in: shopIds }, direction: 'DEBIT' },
    }),
  ])

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Organization Dashboard</h1>
      <p className="text-[hsl(var(--muted-foreground))] mb-6">Consolidated view across your shops</p>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="card">
          <div className="card-body">
            <div className="text-sm text-[hsl(var(--muted-foreground))]">Shops</div>
            <div className="text-2xl font-semibold">{shops.length}</div>
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <div className="text-sm text-[hsl(var(--muted-foreground))]">Users</div>
            <div className="text-2xl font-semibold">{usersInOrg}</div>
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <div className="text-sm text-[hsl(var(--muted-foreground))]">Products</div>
            <div className="text-2xl font-semibold">{productsCount}</div>
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <div className="text-sm text-[hsl(var(--muted-foreground))]">Invoices Today</div>
            <div className="text-2xl font-semibold">{invoicesTodayCount}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <h2 className="font-semibold text-lg mb-2">Outstanding Udhaar</h2>
          <div className="text-2xl font-semibold">
            {Number(outstandingUdhaar._sum.amount || 0).toFixed(2)}
          </div>
        </div>
      </div>
    </div>
  )
}

