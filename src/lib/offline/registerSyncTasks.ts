import { registerSyncTask } from './orchestrator'
import { syncPendingSalesBatch } from './sales'
import { syncPendingPurchasesBatch } from './purchases'
import { syncPendingCustomersBatch } from './customers'
import { syncPendingUdhaarPaymentsBatch } from './udhaarPayments'
import { syncPendingExpensesBatch } from './expenses'
import { syncPendingStockAdjustmentsBatch } from './inventory'

// Register once on import.
// ORDER MATTERS: customers must sync before the records that reference them (sales, udhaar
// payments). An offline-created customer gets a device id; the sale carries that id and the
// server resolves it via clientId - but only if the customer row already exists server-side.
// Syncing customers first means a credit sale for a brand-new customer resolves on the first
// attempt instead of failing once and healing on a later cycle.
registerSyncTask({ name: 'customers', run: syncPendingCustomersBatch })
registerSyncTask({ name: 'sales', run: syncPendingSalesBatch })
registerSyncTask({ name: 'purchases', run: syncPendingPurchasesBatch })
registerSyncTask({ name: 'udhaarPayments', run: syncPendingUdhaarPaymentsBatch })
registerSyncTask({ name: 'expenses', run: syncPendingExpensesBatch })
registerSyncTask({ name: 'stockAdjustments', run: syncPendingStockAdjustmentsBatch })

// Export nothing; side-effect only
export {}

