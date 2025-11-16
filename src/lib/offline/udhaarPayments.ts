import {
  addUdhaarPaymentLocal,
  getPendingUdhaarPayments,
  markUdhaarPaymentAsSynced,
  markUdhaarPaymentSyncError,
  CachedUdhaarPayment,
} from './indexedDb'
import { syncPendingBatch } from './sync'

export interface UdhaarPaymentInput {
  id: string
  shopId: string
  customerId: string
  amount: number
  method: 'CASH' | 'CARD' | 'OTHER'
  note?: string
}

export async function saveUdhaarPaymentLocally(payment: UdhaarPaymentInput): Promise<void> {
  await addUdhaarPaymentLocal(payment)
}

export async function syncPendingUdhaarPaymentsBatch(
  shopId: string
): Promise<{ synced: number; failed: number }> {
  return await syncPendingBatch({
    shopId,
    getPending: getPendingUdhaarPayments,
    markSynced: markUdhaarPaymentAsSynced,
    markError: markUdhaarPaymentSyncError,
    toPayload: (rec) => ({
      id: (rec as CachedUdhaarPayment).id,
      customerId: (rec as CachedUdhaarPayment).customerId,
      amount: (rec as CachedUdhaarPayment).amount,
      method: (rec as CachedUdhaarPayment).method,
      note: (rec as CachedUdhaarPayment).note,
    }),
    endpoint: '/api/udhaar-payments/sync-batch',
  })
}


