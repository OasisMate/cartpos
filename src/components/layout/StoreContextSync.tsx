'use client'

import { useEffect, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'

/**
 * When a Platform Admin / Org Admin drills into a store via URL
 * (/org/[orgId]/stores/[storeId]/...), the store comes from the URL, not the
 * currentShopId cookie. Client pages (POS, products, sales) gate on
 * user.currentShopId, so without this they show "Please select a shop first".
 *
 * This syncs the selected shop to the store in the URL whenever they differ,
 * so every re-exported store page works for admins without per-page changes.
 */
export default function StoreContextSync({ storeId }: { storeId: string }) {
  const { user, selectShop } = useAuth()
  const syncingRef = useRef<string | null>(null)

  useEffect(() => {
    if (!user || !storeId) return
    if (user.currentShopId === storeId) return
    if (syncingRef.current === storeId) return // avoid duplicate calls in flight
    syncingRef.current = storeId
    selectShop(storeId).finally(() => {
      syncingRef.current = null
    })
  }, [user, storeId, selectShop])

  return null
}
