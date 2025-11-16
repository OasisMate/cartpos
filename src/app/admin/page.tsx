import Link from 'next/link'
import { prisma } from '@/lib/db/prisma'
import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function AdminPage() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'PLATFORM_ADMIN') {
    redirect('/')
  }

  const [organizationsCount, shopsCount, usersCount, invoicesToday] = await Promise.all([
    prisma.organization.count(),
    prisma.shop.count(),
    prisma.user.count(),
    prisma.invoice.count({
      where: {
        createdAt: {
          gte: new Date(new Date().toDateString()), // today midnight
        },
        status: 'COMPLETED',
      },
    }),
  ])

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Platform Admin</h1>
      <p className="text-[hsl(var(--muted-foreground))] mb-6">Overview and quick actions</p>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="card">
          <div className="card-body">
            <div className="text-sm text-[hsl(var(--muted-foreground))]">Organizations</div>
            <div className="text-2xl font-semibold">{organizationsCount}</div>
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <div className="text-sm text-[hsl(var(--muted-foreground))]">Shops</div>
            <div className="text-2xl font-semibold">{shopsCount}</div>
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <div className="text-sm text-[hsl(var(--muted-foreground))]">Users</div>
            <div className="text-2xl font-semibold">{usersCount}</div>
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <div className="text-sm text-[hsl(var(--muted-foreground))]">Invoices Today</div>
            <div className="text-2xl font-semibold">{invoicesToday}</div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link
          href="/admin/shops"
          className="card hover:bg-[hsl(var(--muted))] transition-colors"
        >
          <div className="card-body">
            <h2 className="font-semibold text-lg mb-1">Manage Shops</h2>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              Create and manage shops, view owners and statistics.
            </p>
          </div>
        </Link>
        <Link
          href="/admin/organizations"
          className="card hover:bg-[hsl(var(--muted))] transition-colors"
        >
          <div className="card-body">
            <h2 className="font-semibold text-lg mb-1">Organizations</h2>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              Review organization requests, approve or suspend.
            </p>
          </div>
        </Link>
      </div>
    </div>
  )
}

