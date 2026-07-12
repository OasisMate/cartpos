import { registerSyncTask } from './orchestrator'
import { syncPendingSalesBatch } from './sales'
import { syncPendingPurchasesBatch } from './purchases'
import { syncPendingCustomersBatch } from './customers'
import { syncPendingUdhaarPaymentsBatch } from './udhaarPayments'
import { syncPendingExpensesBatch } from './expenses'
import { syncPendingStockAdjustmentsBatch } from './inventory'

// Register once on import
registerSyncTask({ name: 'sales', run: syncPendingSalesBatch })
registerSyncTask({ name: 'purchases', run: syncPendingPurchasesBatch })
registerSyncTask({ name: 'customers', run: syncPendingCustomersBatch })
registerSyncTask({ name: 'udhaarPayments', run: syncPendingUdhaarPaymentsBatch })
registerSyncTask({ name: 'expenses', run: syncPendingExpensesBatch })
registerSyncTask({ name: 'stockAdjustments', run: syncPendingStockAdjustmentsBatch })

// Export nothing; side-effect only
export {}

