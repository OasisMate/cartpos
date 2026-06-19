import { addSale, getPendingSales, markSaleAsSynced, markSaleSyncError, CachedSale } from './indexedDb'
import { fetchJSON } from '@/lib/utils/http'
import { syncPendingBatch } from './sync'

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
    unitsPerItem?: number
  }>
  subtotal: number
  discount: number
  serviceCharge?: number
  deliveryCharge?: number
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
    await fetchJSON('/api/sales', {
      method: 'POST',
      body: JSON.stringify({
        clientSaleId: sale.id,
        customerId: sale.customerId || undefined,
        items: sale.items,
        subtotal: sale.subtotal,
        discount: sale.discount,
        serviceCharge: sale.serviceCharge,
        deliveryCharge: sale.deliveryCharge,
        total: sale.total,
        paymentStatus: sale.paymentStatus,
        paymentMethod: sale.paymentMethod,
        amountReceived: sale.amountReceived,
      }),
    })

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
  return await syncPendingBatch({
    shopId,
    getPending: getPendingSales,
    markSynced: markSaleAsSynced,
    markError: markSaleSyncError,
    toPayload: (sale) => ({
      id: (sale as CachedSale).id,
      customerId: (sale as CachedSale).customerId || undefined,
      items: (sale as CachedSale).items,
      subtotal: (sale as CachedSale).subtotal,
      discount: (sale as CachedSale).discount,
      serviceCharge: (sale as CachedSale).serviceCharge,
      deliveryCharge: (sale as CachedSale).deliveryCharge,
      total: (sale as CachedSale).total,
      paymentStatus: (sale as CachedSale).paymentStatus,
      paymentMethod: (sale as CachedSale).paymentMethod,
      amountReceived: (sale as CachedSale).amountReceived,
    }),
    endpoint: '/api/sales/sync-batch',
  })
}

/**
 * Save sale locally and sync if online.
 * Online sync is deferred (queueMicrotask) so the POS UI can show the receipt without waiting on the network.
 * Duplicates are still impossible: server uses clientSaleId + unique index + idempotent createSale; batch sync
 * marks skippedIds as SYNCED; submit lock prevents double checkout.
 */
export async function saveSale(sale: SaleInput, isOnline: boolean): Promise<{ saved: boolean; synced: boolean }> {
  await saveSaleLocally(sale)

  if (isOnline) {
    const cachedLike: CachedSale = {
      ...sale,
      createdAt: Date.now(),
      syncStatus: 'PENDING',
    }
    queueMicrotask(() => {
      void syncSaleToServer(cachedLike)
    })
  }

  return { saved: true, synced: false }
}
