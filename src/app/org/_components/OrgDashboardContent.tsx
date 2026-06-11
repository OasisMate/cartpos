import { Receipt, Wallet, HandCoins, FileText, Store, Users, Package, UserSquare } from 'lucide-react'
import { formatCurrency } from '@/lib/utils/money'
import type { OrgDashboard } from '@/lib/domain/dashboard'
import { StatCard, SectionCard, AreaTrend } from '@/components/dashboard/DashboardParts'

function MiniStat({ label, value, icon: Icon }: { label: string; value: number; icon: typeof Store }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[hsl(var(--border))] bg-white p-4 shadow-sm">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100">
        <Icon className="h-5 w-5 text-slate-600" />
      </div>
      <div>
        <div className="text-sm text-[hsl(var(--muted-foreground))]">{label}</div>
        <div className="text-xl font-semibold">{value}</div>
      </div>
    </div>
  )
}

export function OrgDashboardContent({ data }: { data: OrgDashboard }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Organization Dashboard</h1>
          <p className="text-[hsl(var(--muted-foreground))]">Consolidated view across your shops</p>
        </div>
        <span className="rounded-full bg-[hsl(var(--muted))] px-3 py-1 text-sm font-medium text-[hsl(var(--muted-foreground))]">
          {new Date().toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })}
        </span>
      </div>

      {/* Today across all shops */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Sales today"
          value={formatCurrency(data.salesToday)}
          icon={Receipt}
          accent="blue"
          hint={`${data.invoicesToday} invoice${data.invoicesToday === 1 ? '' : 's'}`}
        />
        <StatCard label="Payments today" value={formatCurrency(data.paymentsToday)} icon={Wallet} accent="violet" />
        <StatCard
          label="Outstanding udhaar"
          value={formatCurrency(data.receivables)}
          icon={HandCoins}
          accent="amber"
          hint="customers owe you"
        />
        <StatCard label="Invoices today" value={String(data.invoicesToday)} icon={FileText} accent="emerald" />
      </div>

      {/* Structure counts */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MiniStat label="Stores" value={data.shopsCount} icon={Store} />
        <MiniStat label="Staff" value={data.usersCount} icon={Users} />
        <MiniStat label="Products" value={data.productsCount} icon={Package} />
        <MiniStat label="Customers" value={data.customersCount} icon={UserSquare} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SectionCard title="Last 7 days sales" action={{ label: 'Stores', href: '/org/stores' }}>
            <AreaTrend data={data.trend} />
          </SectionCard>
        </div>

        <SectionCard title="Sales today by store">
          {data.perStore.length === 0 ? (
            <div className="text-sm text-[hsl(var(--muted-foreground))]">No stores yet.</div>
          ) : (
            <ul className="divide-y divide-[hsl(var(--border))]">
              {data.perStore.map((s) => (
                <li key={s.shopId} className="flex items-center justify-between py-2 text-sm">
                  <span className="truncate font-medium">{s.name}</span>
                  <span className="flex shrink-0 items-center gap-3">
                    <span className="text-xs text-[hsl(var(--muted-foreground))]">{s.invoices} inv</span>
                    <span className="font-semibold">{formatCurrency(s.sales)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </div>
  )
}
