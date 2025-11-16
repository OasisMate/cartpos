import { useEffect } from 'react'
import { useOnlineStatus } from './useOnlineStatus'

export function useOnlineSync(
  shopId: string | undefined,
  syncFn: (shopId: string) => Promise<unknown>
) {
  const isOnline = useOnlineStatus()

  useEffect(() => {
    if (isOnline && shopId) {
      syncFn(shopId).catch((err) => {
        console.error('Background sync failed:', err)
      })
    }
  }, [isOnline, shopId, syncFn])
}

