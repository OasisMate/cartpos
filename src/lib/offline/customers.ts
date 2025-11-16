import { getPendingCustomers, markCustomerAsSynced, markCustomerSyncError, CachedCustomer } from './indexedDb'
import { syncPendingBatch } from './sync'

export async function syncPendingCustomersBatch(
  shopId: string
): Promise<{ synced: number; failed: number }> {
  return await syncPendingBatch({
    shopId,
    getPending: getPendingCustomers,
    markSynced: async (id) => {
      await markCustomerAsSynced(id)
    },
    markError: async (id, error) => {
      await markCustomerSyncError(id, error)
    },
    toPayload: (rec) => ({
      id: (rec as CachedCustomer).id,
      name: (rec as CachedCustomer).name,
      phone: (rec as CachedCustomer).phone || undefined,
      notes: (rec as CachedCustomer).notes || undefined,
    }),
    endpoint: '/api/customers/sync-batch',
  })
}


