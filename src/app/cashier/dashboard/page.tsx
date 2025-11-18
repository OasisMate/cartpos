import { prisma } from '@/lib/db/prisma'
import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'

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

  const today = new Date(new Date().toDateString())

  // Get cashier's personal stats
  const [myInvoicesToday, myTotalSalesToday, lowStockProducts] = await Promise.all([
    prisma.invoice.count({
      where: {
        shopId,
        createdByUserId: user.id,
        createdAt: { gte: today },
        status: 'COMPLETED',
      },
    }),
    prisma.invoice.aggregate({
      _sum: { total: true },
      where: {
        shopId,
        createdByUserId: user.id,
        createdAt: { gte: today },
        status: 'COMPLETED',
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
      take: 10,
    }),
  ])

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">My Dashboard</h1>
      <p className="text-[hsl(var(--muted-foreground))] mb-6">
        Your performance today at {shop?.name}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="card">
          <div className="card-body">
            <div className="text-sm text-[hsl(var(--muted-foreground))]">My Sales Today</div>
            <div className="text-2xl font-semibold">{myInvoicesToday}</div>
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <div className="text-sm text-[hsl(var(--muted-foreground))]">Total Amount</div>
            <div className="text-2xl font-semibold">
              {Number(myTotalSalesToday._sum.total || 0).toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {lowStockProducts.length > 0 && (
        <div className="card">
          <div className="card-body">
            <h2 className="font-semibold text-lg mb-4">Low Stock Alert</h2>
            <div className="space-y-2">
              {lowStockProducts.map((product) => (
                <div
                  key={product.id}
                  className="flex justify-between items-center p-2 bg-[hsl(var(--muted))] rounded"
                >
                  <span className="font-medium">{product.name}</span>
                  <span className="text-sm text-[hsl(var(--muted-foreground))]">
                    Reorder at: {product.reorderLevel}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="mt-6">
        <a
          href="/pos"
          className="block w-full md:w-auto text-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
        >
          Open POS
        </a>
      </div>
    </div>
  )
}

