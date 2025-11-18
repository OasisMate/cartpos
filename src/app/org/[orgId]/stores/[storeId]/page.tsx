import { prisma } from '@/lib/db/prisma'
import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'

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
  const hasStoreRole = user.shops?.some((s: any) => s.shopId === storeId)

  if (!isPlatformAdmin && !isOrgAdmin && !hasStoreRole) {
    redirect('/')
  }

  const today = new Date(new Date().toDateString())

  const [invoicesToday, paymentsToday, udhaarCreatedToday, lowStockCount] = await Promise.all([
    prisma.invoice.count({
      where: { shopId: storeId, createdAt: { gte: today }, status: 'COMPLETED' },
    }),
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: { shopId: storeId, createdAt: { gte: today } },
    }),
    prisma.customerLedger.aggregate({
      _sum: { amount: true },
      where: { shopId: storeId, createdAt: { gte: today }, type: 'SALE_UDHAAR', direction: 'DEBIT' },
    }),
    prisma.product.count({
      where: {
        shopId: storeId,
        trackStock: true,
        reorderLevel: { not: null },
      },
    }),
  ])

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">{store.name} — Dashboard</h1>
      <p className="text-[hsl(var(--muted-foreground))] mb-6">Today&apos;s snapshot and quick actions</p>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="card">
          <div className="card-body">
            <div className="text-sm text-[hsl(var(--muted-foreground))]">Invoices Today</div>
            <div className="text-2xl font-semibold">{invoicesToday}</div>
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <div className="text-sm text-[hsl(var(--muted-foreground))]">Payments Today</div>
            <div className="text-2xl font-semibold">{Number(paymentsToday._sum.amount || 0).toFixed(2)}</div>
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <div className="text-sm text-[hsl(var(--muted-foreground))]">Udhaar Today</div>
            <div className="text-2xl font-semibold">
              {Number(udhaarCreatedToday._sum.amount || 0).toFixed(2)}
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <div className="text-sm text-[hsl(var(--muted-foreground))]">Low Stock Items</div>
            <div className="text-2xl font-semibold">{lowStockCount}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <a className="card hover:bg-[hsl(var(--muted))] transition-colors" href={`/org/${orgId}/stores/${storeId}/pos`}>
          <div className="card-body">
            <div className="text-sm text-[hsl(var(--muted-foreground))]">Quick Action</div>
            <div className="text-lg font-semibold">Open POS</div>
          </div>
        </a>
        <a className="card hover:bg-[hsl(var(--muted))] transition-colors" href={`/org/${orgId}/stores/${storeId}/products`}>
          <div className="card-body">
            <div className="text-sm text-[hsl(var(--muted-foreground))]">Quick Action</div>
            <div className="text-lg font-semibold">Add Product</div>
          </div>
        </a>
        <a className="card hover:bg-[hsl(var(--muted))] transition-colors" href={`/org/${orgId}/stores/${storeId}/customers`}>
          <div className="card-body">
            <div className="text-sm text-[hsl(var(--muted-foreground))]">Quick Action</div>
            <div className="text-lg font-semibold">Record Udhaar Payment</div>
          </div>
        </a>
      </div>
    </div>
  )
}
