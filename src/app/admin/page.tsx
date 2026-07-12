import { prisma } from '@/lib/db/prisma'
import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Building2, Users, Store, FileText } from 'lucide-react'
import { StatCard, QuickAction } from '@/components/dashboard/DashboardParts'

export default async function AdminPage() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'PLATFORM_ADMIN') {
    redirect('/')
  }

  const [organizationsCount, shopsCount, usersCount, invoicesToday, syncReportsNew] = await Promise.all([
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
    prisma.syncErrorReport.count({ where: { status: 'NEW' } }),
  ])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Platform Admin</h1>
          <p className="text-[hsl(var(--muted-foreground))]">Overview across every organization</p>
        </div>
        <span className="rounded-full bg-[hsl(var(--muted))] px-3 py-1 text-sm font-medium text-[hsl(var(--muted-foreground))]">
          {new Date().toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Organizations" value={String(organizationsCount)} icon={Building2} accent="blue" hint="total registered" />
        <StatCard label="Shops" value={String(shopsCount)} icon={Store} accent="amber" hint="across all orgs" />
        <StatCard label="Users" value={String(usersCount)} icon={Users} accent="violet" hint="total accounts" />
        <StatCard label="Invoices today" value={String(invoicesToday)} icon={FileText} accent="emerald" hint="completed today" />
      </div>

      <div>
        <h2 className="mb-3 font-semibold">Manage</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <QuickAction href="/admin/organizations" label="Organizations" icon={Building2} primary />
          <QuickAction href="/admin/users" label="Users" icon={Users} />
          <QuickAction href="/admin/shops" label="Shops" icon={Store} />
          <QuickAction href="/admin/sync-reports" label={syncReportsNew > 0 ? `Sync reports (${syncReportsNew})` : 'Sync reports'} icon={FileText} />
        </div>
      </div>
    </div>
  )
}
