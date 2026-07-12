import { addStockAdjustmentLocal, getPendingStockAdjustments, markStockAdjustmentAsSynced, markStockAdjustmentSyncError, CachedStockAdjustment } from './indexedDb'
import { syncPendingBatch } from './sync'

// Stock Adjustment input type
export interface StockAdjustmentInput {
    id: string
    shopId: string
    productId: string
    quantity: number
    type: 'DAMAGE' | 'EXPIRY' | 'RETURN' | 'SELF_USE' | 'ADJUSTMENT'
    notes?: string
}

/**
 * Save stock adjustment to IndexedDB (always, for offline-first)
 */
export async function saveStockAdjustmentLocally(adjustment: StockAdjustmentInput): Promise<void> {
    await addStockAdjustmentLocal(adjustment)
}

/**
 * Save stock adjustment locally and sync if online
 */
export async function saveStockAdjustment(adjustment: StockAdjustmentInput, isOnline: boolean): Promise<{ saved: boolean; synced: boolean }> {
    await saveStockAdjustmentLocally(adjustment)
    if (isOnline) {
        // Prompt push; safe to retry (idempotent). Background pass + banner cover offline.
        void syncPendingStockAdjustmentsBatch(adjustment.shopId)
    }
    return { saved: true, synced: false }
}

/**
 * Batch sync pending stock adjustments to server (idempotent via clientId = local id).
 */
export async function syncPendingStockAdjustmentsBatch(
    shopId: string
): Promise<{ synced: number; failed: number; firstError?: string }> {
    return await syncPendingBatch({
        shopId,
        getPending: getPendingStockAdjustments,
        markSynced: markStockAdjustmentAsSynced,
        markError: markStockAdjustmentSyncError,
        toPayload: (rec) => ({
            id: (rec as CachedStockAdjustment).id,
            productId: (rec as CachedStockAdjustment).productId,
            quantity: (rec as CachedStockAdjustment).quantity,
            type: (rec as CachedStockAdjustment).type,
            notes: (rec as CachedStockAdjustment).notes,
            createdAt: (rec as CachedStockAdjustment).createdAt,
        }),
        endpoint: '/api/inventory/adjustments/sync-batch',
    })
}
