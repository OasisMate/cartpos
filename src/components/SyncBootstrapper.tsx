'use client'

import { useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useBackgroundSync } from '@/hooks/useBackgroundSync'
import '@/lib/offline/registerSyncTasks'

export function SyncBootstrapper() {
  const { user } = useAuth()
  // Runs global background sync for the active shop
  useBackgroundSync(user?.currentShopId || undefined, 45000)

  // No UI
  useEffect(() => {}, [])
  return null
}

