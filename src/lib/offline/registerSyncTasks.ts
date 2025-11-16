import { registerSyncTask } from './orchestrator'
import { syncPendingSalesBatch } from './sales'
import { syncPendingPurchasesBatch } from './purchases'

// Register once on import
registerSyncTask({ name: 'sales', run: syncPendingSalesBatch })
registerSyncTask({ name: 'purchases', run: syncPendingPurchasesBatch })

// Export nothing; side-effect only
export {}

