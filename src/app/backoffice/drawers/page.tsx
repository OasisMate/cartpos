import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { canViewReports } from '@/lib/permissions'
import { listShifts } from '@/lib/domain/shifts'
import DrawersClient, { type DrawerRow } from '@/components/shifts/DrawersClient'

// Manager/owner view of cash drawers across the shop: open + closed, variances per cashier,
// and force-close for abandoned drawers (the "take over on shift change" flow).
export default async function DrawersPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (!user.currentShopId) redirect('/select-shop')
  if (!canViewReports(user, user.currentShopId)) redirect('/store')

  const shifts = await listShifts(user.currentShopId, {})

  const rows: DrawerRow[] = shifts.map((s) => ({
    id: s.id,
    label: s.label,
    status: s.status,
    openedByName: s.openedBy?.name || 'Unknown',
    openingFloat: Number(s.openingFloat),
    openedAt: s.openedAt.toISOString(),
    closedByName: s.closedBy?.name ?? null,
    closedAt: s.closedAt ? s.closedAt.toISOString() : null,
    countedCash: s.countedCash != null ? Number(s.countedCash) : null,
    expectedCash: s.expectedCash != null ? Number(s.expectedCash) : null,
    variance: s.variance != null ? Number(s.variance) : null,
  }))

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Cash Drawers</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Open and closed drawers for this shop. Close a drawer on handover, or if a cashier forgot to.
        </p>
      </div>
      <DrawersClient initial={rows} />
    </div>
  )
}
