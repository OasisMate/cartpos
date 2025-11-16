import {
  addPurchaseLocal,
  getPendingPurchases,
  markPurchaseAsSynced,
  markPurchaseSyncError,
  CachedPurchase,
} from './indexedDb'
import { syncPendingBatch } from './sync'

export interface PurchaseInput {
  id: string
  shopId: string
  supplierId?: string
  date?: number
  reference?: string
  notes?: string
  lines: Array<{
    productId: string
    quantity: number
    unitCost?: number
  }>
}

export async function savePurchaseLocally(purchase: PurchaseInput): Promise<void> {
  await addPurchaseLocal(purchase)
}

export async function syncPendingPurchasesBatch(
  shopId: string
): Promise<{ synced: number; failed: number }> {
  return await syncPendingBatch({
    shopId,
    getPending: getPendingPurchases,
    markSynced: markPurchaseAsSynced,
    markError: markPurchaseSyncError,
    toPayload: (rec) => ({
      id: (rec as CachedPurchase).id,
      supplierId: (rec as CachedPurchase).supplierId,
      date: (rec as CachedPurchase).date,
      reference: (rec as CachedPurchase).reference,
      notes: (rec as CachedPurchase).notes,
      lines: (rec as CachedPurchase).lines,
    }),
    endpoint: '/api/purchases/sync-batch',
  })
}

