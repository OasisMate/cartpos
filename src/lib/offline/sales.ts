import { addSale, getPendingSales, markSaleAsSynced, markSaleSyncError, CachedSale } from './indexedDb'

// Sale input type
export interface SaleInput {
  id: string // client-generated ID
  shopId: string
  customerId?: string
  items: Array<{
    productId: string
    quantity: number
    unitPrice: number
    lineTotal: number
  }>
  subtotal: number
  discount: number
  total: number
  paymentStatus: 'PAID' | 'UDHAAR'
  paymentMethod?: 'CASH' | 'CARD' | 'OTHER'
  amountReceived?: number
}

/**
 * Save sale to IndexedDB (always, for offline-first)
 */
export async function saveSaleLocally(sale: SaleInput): Promise<void> {
  await addSale(sale)
}

/**
 * Sync sale to server (if online)
 */
export async function syncSaleToServer(sale: CachedSale): Promise<boolean> {
  try {
    const response = await fetch('/api/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId: sale.customerId || undefined,
        items: sale.items,
        subtotal: sale.subtotal,
        discount: sale.discount,
        total: sale.total,
        paymentStatus: sale.paymentStatus,
        paymentMethod: sale.paymentMethod,
        amountReceived: sale.amountReceived,
      }),
    })

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Failed to sync sale')
    }

    await markSaleAsSynced(sale.id)
    return true
  } catch (error: any) {
    await markSaleSyncError(sale.id, error.message || 'Sync failed')
    console.error('Error syncing sale:', error)
    return false
  }
}

/**
 * Sync all pending sales to server (one by one)
 */
export async function syncPendingSales(shopId: string): Promise<{ synced: number; failed: number }> {
  const pendingSales = await getPendingSales(shopId)
  let synced = 0
  let failed = 0

  for (const sale of pendingSales) {
    const success = await syncSaleToServer(sale)
    if (success) {
      synced++
    } else {
      failed++
    }
  }

  return { synced, failed }
}

/**
 * Batch sync pending sales to server
 */
export async function syncPendingSalesBatch(shopId: string): Promise<{ synced: number; failed: number }> {
  const pendingSales = await getPendingSales(shopId)
  
  if (pendingSales.length === 0) {
    return { synced: 0, failed: 0 }
  }

  try {
    const response = await fetch('/api/sales/sync-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sales: pendingSales.map((sale) => ({
          id: sale.id,
          customerId: sale.customerId || undefined,
          items: sale.items,
          subtotal: sale.subtotal,
          discount: sale.discount,
          total: sale.total,
          paymentStatus: sale.paymentStatus,
          paymentMethod: sale.paymentMethod,
          amountReceived: sale.amountReceived,
        })),
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to sync sales batch')
    }

    const data = await response.json()
    
    // Mark successfully synced sales
    for (const sale of pendingSales) {
      const error = data.errors?.find((e: any) => e.id === sale.id)
      if (!error) {
        // No error means it was synced (or skipped if duplicate)
        await markSaleAsSynced(sale.id)
      } else {
        await markSaleSyncError(sale.id, error.error)
      }
    }

    return {
      synced: data.synced || 0,
      failed: data.errors?.length || 0,
    }
  } catch (error: any) {
    console.error('Error syncing sales batch:', error)
    return { synced: 0, failed: pendingSales.length }
  }
}

/**
 * Save sale locally and sync if online
 */
export async function saveSale(sale: SaleInput, isOnline: boolean): Promise<{ saved: boolean; synced: boolean }> {
  // Always save locally first (offline-first)
  await saveSaleLocally(sale)

  // Try to sync if online
  if (isOnline) {
    const cachedSale = await getPendingSales(sale.shopId).then((sales) =>
      sales.find((s) => s.id === sale.id)
    )
    if (cachedSale) {
      const synced = await syncSaleToServer(cachedSale)
      return { saved: true, synced }
    }
  }

  return { saved: true, synced: false }
}
