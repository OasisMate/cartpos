import { useEffect, useRef } from 'react'
import { useOnlineStatus } from './useOnlineStatus'
import { runAllSyncTasks } from '@/lib/offline/orchestrator'

export function useBackgroundSync(shopId: string | undefined, intervalMs: number = 45000) {
  const isOnline = useOnlineStatus()
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // On online transition, trigger a sync pass
  useEffect(() => {
    if (isOnline && shopId) {
      runAllSyncTasks(shopId).catch((err) => console.error('Background sync error:', err))
    }
  }, [isOnline, shopId])

  // Periodic sync while online
  useEffect(() => {
    if (!isOnline || !shopId) return
    timerRef.current = setInterval(() => {
      runAllSyncTasks(shopId).catch((err) => console.error('Periodic sync error:', err))
    }, intervalMs)
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [isOnline, shopId, intervalMs])
}

