import { prisma } from '@/lib/db/prisma'
import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { ReportsClient } from './ReportsClient'

export default async function SyncReportsPage() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'PLATFORM_ADMIN') redirect('/')

  const reports = await prisma.syncErrorReport.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Sync error reports</h1>
        <p className="text-[hsl(var(--muted-foreground))]">Reports sent from shop devices when sync fails</p>
      </div>
      <ReportsClient
        initial={reports.map((r) => ({
          id: r.id,
          shopId: r.shopId,
          orgId: r.orgId,
          userId: r.userId,
          status: r.status,
          createdAt: r.createdAt.toISOString(),
          payload: r.payload as unknown,
        }))}
      />
    </div>
  )
}
