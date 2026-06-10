import { Receipt, Wallet, HandCoins, ShoppingCart, UserPlus } from 'lucide-react'
import { formatCurrency } from '@/lib/utils/money'
import type { CashierDashboard as CashierData } from '@/lib/domain/dashboard'
import { StatCard, SectionCard, QuickAction, RecentSalesList } from './DashboardParts'

export function CashierDashboard({
  shopName,
  data,
}: {
  shopName: string
  data: CashierData
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{shopName}</h1>
        <p className="text-[hsl(var(--muted-foreground))]">Today&apos;s counter activity</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Sales today"
          value={formatCurrency(data.totalSales)}
          icon={Receipt}
          accent="blue"
          hint={`${data.totalInvoices} invoice${data.totalInvoices === 1 ? '' : 's'}`}
        />
        <StatCard
          label="Payments collected"
          value={formatCurrency(data.totalPaymentsReceived)}
          icon={Wallet}
          accent="emerald"
        />
        <StatCard
          label="Udhaar given today"
          value={formatCurrency(data.totalUdhaar)}
          icon={HandCoins}
          accent="amber"
        />
      </div>

      <div>
        <h2 className="mb-3 font-semibold">Quick actions</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <QuickAction href="/store/pos" label="Open POS" icon={ShoppingCart} primary />
          <QuickAction href="/store/customers" label="Receive Udhaar" icon={HandCoins} />
          <QuickAction href="/store/customers" label="Add Customer" icon={UserPlus} />
        </div>
      </div>

      <SectionCard title="Recent sales" action={{ label: 'All sales', href: '/store/sales' }}>
        <RecentSalesList sales={data.recentSales} />
      </SectionCard>
    </div>
  )
}
