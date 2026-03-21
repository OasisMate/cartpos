'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useBackgroundSync } from '@/hooks/useBackgroundSync'
import { SyncStatusBanner } from '@/components/SyncStatusBanner'
import '@/lib/offline/registerSyncTasks'

export function SyncBootstrapper() {
  const { user } = useAuth()
  const shopId = user?.currentShopId || undefined

  // When online: on reconnect + every 45s, push pending sales/purchases/customers/payments
  useBackgroundSync(shopId, 45000)

  return <SyncStatusBanner shopId={shopId} />
}

