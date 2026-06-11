import { redirect } from 'next/navigation'

// Legacy route. The store dashboard now lives at /store (single source of truth:
// ManagerDashboard / CashierDashboard). Redirect any old links here.
export default function LegacyShopDashboardPage() {
  redirect('/store')
}
