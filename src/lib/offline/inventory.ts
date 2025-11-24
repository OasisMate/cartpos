import { addStockAdjustmentLocal, getPendingStockAdjustments, markStockAdjustmentAsSynced, markStockAdjustmentSyncError, CachedStockAdjustment } from './indexedDb'
import { fetchJSON } from '@/lib/utils/http'

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
 * Sync stock adjustment to server (if online)
 */
export async function syncStockAdjustmentToServer(adjustment: CachedStockAdjustment): Promise<boolean> {
    try {
        await fetchJSON('/api/inventory/adjustments', {
            method: 'POST',
            body: JSON.stringify({
                productId: adjustment.productId,
                quantity: adjustment.quantity,
                type: adjustment.type,
                notes: adjustment.notes,
                createdAt: new Date(adjustment.createdAt).toISOString(), // Send original creation time
            }),
        })

        await markStockAdjustmentAsSynced(adjustment.id)
        return true
    } catch (error: any) {
        await markStockAdjustmentSyncError(adjustment.id, error.message || 'Sync failed')
        console.error('Error syncing stock adjustment:', error)
        return false
    }
}

/**
 * Save stock adjustment locally and sync if online
 */
export async function saveStockAdjustment(adjustment: StockAdjustmentInput, isOnline: boolean): Promise<{ saved: boolean; synced: boolean }> {
    // Always save locally first (offline-first)
    await saveStockAdjustmentLocally(adjustment)

    // Try to sync if online
    if (isOnline) {
        const cachedAdjustment = await getPendingStockAdjustments(adjustment.shopId).then((adjustments) =>
            adjustments.find((a) => a.id === adjustment.id)
        )
        if (cachedAdjustment) {
            const synced = await syncStockAdjustmentToServer(cachedAdjustment)
            return { saved: true, synced }
        }
    }

    return { saved: true, synced: false }
}
