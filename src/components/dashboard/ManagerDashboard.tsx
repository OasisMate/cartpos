import Link from 'next/link'
import { Receipt, TrendingUp, Wallet, HandCoins, AlertTriangle, ShoppingCart, PackagePlus, Users } from 'lucide-react'
import { formatCurrency, formatNumber } from '@/lib/utils/money'
import type { ManagerDashboard as ManagerData, OrgStoreToday } from '@/lib/domain/dashboard'
import { StatCard, DeltaChip, SectionCard, AreaTrend, QuickAction, RecentSalesList } from './DashboardParts'

export function ManagerDashboard({
  shopName,
  data,
  orgStores,
  basePath = '/store',
}: {
  shopName: string
  data: ManagerData
  orgStores?: OrgStoreToday[]
  /** Route prefix for in-dashboard links. `/store` for the manager's own store,
   *  `/org/{orgId}/stores/{storeId}` when an admin drills into a specific store. */
  basePath?: string
}) {
  const { today, yesterday, trend, receivables, payables, lowStock, lowStockCount, topProducts, recentSales } = data

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">{shopName}</h1>
          <p className="text-[hsl(var(--muted-foreground))]">Today&apos;s performance and what needs your attention</p>
        </div>
        <span className="rounded-full bg-[hsl(var(--muted))] px-3 py-1 text-sm font-medium text-[hsl(var(--muted-foreground))]">
          {new Date().toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })}
        </span>
      </div>

      {/* KPIs with vs-yesterday deltas */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Sales today"
          value={formatCurrency(today.totalSales)}
          icon={Receipt}
          accent="blue"
          hint={`${today.totalInvoices} invoice${today.totalInvoices === 1 ? '' : 's'}`}
          delta={<DeltaChip onColor current={today.totalSales} previous={yesterday.totalSales} />}
        />
        <StatCard
          label="Gross profit today"
          value={formatCurrency(today.grossProfit)}
          icon={TrendingUp}
          accent="emerald"
          hint="after cost of goods"
          delta={<DeltaChip onColor current={today.grossProfit} previous={yesterday.grossProfit} />}
        />
        <StatCard
          label="Payments received"
          value={formatCurrency(today.totalPaymentsReceived)}
          icon={Wallet}
          accent="violet"
          delta={<DeltaChip onColor current={today.totalPaymentsReceived} previous={yesterday.totalPaymentsReceived} />}
        />
        <StatCard
          label="Udhaar given today"
          value={formatCurrency(today.totalUdhaar)}
          icon={HandCoins}
          accent="amber"
          delta={<DeltaChip onColor current={today.totalUdhaar} previous={yesterday.totalUdhaar} goodWhenUp={false} />}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* 7-day trend */}
        <div className="lg:col-span-2">
          <SectionCard title="Last 7 days sales" action={{ label: 'Reports', href: `${basePath}/reports` }}>
            <AreaTrend data={trend} />
          </SectionCard>
        </div>

        {/* Money on the street */}
        <SectionCard title="Money on the street">
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2.5">
              <div>
                <div className="text-sm font-medium text-amber-800">Receivables</div>
                <div className="text-xs text-amber-700/80">Customers owe you</div>
              </div>
              <div className="text-lg font-semibold text-amber-800">{formatCurrency(receivables)}</div>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-rose-50 px-3 py-2.5">
              <div>
                <div className="text-sm font-medium text-rose-800">Payables</div>
                <div className="text-xs text-rose-700/80">You owe suppliers</div>
              </div>
              <div className="text-lg font-semibold text-rose-800">{formatCurrency(payables)}</div>
            </div>
          </div>
        </SectionCard>
      </div>

      {/* Org-wide store comparison (only for owners with multiple stores) */}
      {orgStores && orgStores.length > 1 && (
        <SectionCard title="Sales today by store">
          <ul className="divide-y divide-[hsl(var(--border))]">
            {orgStores.map((s) => (
              <li key={s.shopId} className="flex items-center justify-between py-2 text-sm">
                <span className="font-medium">{s.name}</span>
                <span className="flex items-center gap-3">
                  <span className="text-xs text-[hsl(var(--muted-foreground))]">{s.invoices} inv</span>
                  <span className="font-semibold">{formatCurrency(s.sales)}</span>
                </span>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Low stock */}
        <SectionCard
          title={`Low stock${lowStockCount > 0 ? ` (${lowStockCount})` : ''}`}
          action={{ label: 'Products', href: `${basePath}/products` }}
        >
          {lowStock.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-emerald-700">
              <span>All tracked items are above their reorder level.</span>
            </div>
          ) : (
            <ul className="divide-y divide-[hsl(var(--border))]">
              {lowStock.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="flex items-center gap-2 min-w-0">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
                    <span className="truncate font-medium">{p.name}</span>
                  </span>
                  <span className="shrink-0 text-xs">
                    <span className={p.onHand <= 0 ? 'font-semibold text-rose-600' : 'text-[hsl(var(--muted-foreground))]'}>
                      {formatNumber(p.onHand)}
                    </span>
                    <span className="text-[hsl(var(--muted-foreground))]"> / {formatNumber(p.reorderLevel)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        {/* Sales volume this week (by units sold) */}
        <SectionCard title="Sales volume this week">
          {topProducts.length === 0 ? (
            <div className="text-sm text-[hsl(var(--muted-foreground))]">No sales in the last 7 days.</div>
          ) : (
            <ul className="divide-y divide-[hsl(var(--border))]">
              {topProducts.map((p, i) => (
                <li key={`${p.name}-${i}`} className="flex items-center justify-between py-2 text-sm">
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-semibold text-[hsl(var(--muted-foreground))] w-4">{i + 1}</span>
                    <span className="truncate font-medium">{p.name}</span>
                  </span>
                  <span className="shrink-0 text-xs text-[hsl(var(--muted-foreground))]">
                    {formatNumber(p.qty)} sold · <span className="font-semibold text-[hsl(var(--foreground))]">{formatCurrency(p.revenue)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Quick actions */}
        <div>
          <h2 className="mb-3 font-semibold">Quick actions</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <QuickAction href={`${basePath}/pos`} label="Open POS" icon={ShoppingCart} primary />
            <QuickAction href={`${basePath}/customers`} label="Receive Udhaar" icon={HandCoins} />
            <QuickAction href={`${basePath}/products`} label="Add Product" icon={PackagePlus} />
            <QuickAction href={`${basePath}/customers`} label="Customers" icon={Users} />
          </div>
        </div>

        {/* Recent sales */}
        <SectionCard title="Recent sales" action={{ label: 'All sales', href: `${basePath}/sales` }}>
          <RecentSalesList sales={recentSales} />
        </SectionCard>
      </div>
    </div>
  )
}
