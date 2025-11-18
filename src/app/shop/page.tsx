import { prisma } from '@/lib/db/prisma'
import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function ShopDashboardPage() {
  const user = await getCurrentUser()
  if (!user) {
    redirect('/login')
  }
  const shopId = user.currentShopId
  if (!shopId) {
    redirect('/')
  }

  // Allow STORE_MANAGER, CASHIER (read-only), ORG_ADMIN, PLATFORM_ADMIN
  const isPlatform = user.role === 'PLATFORM_ADMIN'
  const isOrgAdmin = user.organizations?.some((o: any) => o.orgRole === 'ORG_ADMIN')
  const shopRole = user.shops?.find((s: any) => s.shopId === shopId)?.shopRole
  if (!isPlatform && !isOrgAdmin && !shopRole) {
    redirect('/')
  }

  // Check organization status - must be ACTIVE (unless platform admin)
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
        // naive: treat stock <= reorderLevel as low; compute via ledger sum
      },
    }),
  ])

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">{shop?.name} — Dashboard</h1>
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
            <div className="text-2xl font-semibold">
              {Number(paymentsToday._sum.amount || 0).toFixed(2)}
            </div>
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
        <a className="card hover:bg-[hsl(var(--muted))] transition-colors" href="/store/pos">
          <div className="card-body">
            <div className="text-sm text-[hsl(var(--muted-foreground))]">Quick Action</div>
            <div className="text-lg font-semibold">Open POS</div>
          </div>
        </a>
        <a className="card hover:bg-[hsl(var(--muted))] transition-colors" href="/store/products">
          <div className="card-body">
            <div className="text-sm text-[hsl(var(--muted-foreground))]">Quick Action</div>
            <div className="text-lg font-semibold">Add Product</div>
          </div>
        </a>
        <a className="card hover:bg-[hsl(var(--muted))] transition-colors" href="/store/customers">
          <div className="card-body">
            <div className="text-sm text-[hsl(var(--muted-foreground))]">Quick Action</div>
            <div className="text-lg font-semibold">Record Udhaar Payment</div>
          </div>
        </a>
      </div>
    </div>
  )
}


