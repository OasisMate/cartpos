import { addExpenseLocal, getPendingExpenses, markExpenseAsSynced, markExpenseSyncError, CachedExpense } from './indexedDb'
import { syncPendingBatch } from './sync'

// Expense input type
export interface ExpenseInput {
    id: string
    shopId: string
    category: string
    amount: number
    description?: string
    date: number
}

/**
 * Save expense to IndexedDB (always, for offline-first)
 */
export async function saveExpenseLocally(expense: ExpenseInput): Promise<void> {
    await addExpenseLocal(expense)
}

/**
 * Save expense locally and sync if online
 */
export async function saveExpense(expense: ExpenseInput, isOnline: boolean): Promise<{ saved: boolean; synced: boolean }> {
    await saveExpenseLocally(expense)
    if (isOnline) {
        // Prompt push; safe to retry (idempotent). Background pass + banner cover offline.
        void syncPendingExpensesBatch(expense.shopId)
    }
    return { saved: true, synced: false }
}

/**
 * Batch sync pending expenses to server (idempotent via clientId = local id).
 */
export async function syncPendingExpensesBatch(
    shopId: string
): Promise<{ synced: number; failed: number; firstError?: string }> {
    return await syncPendingBatch({
        shopId,
        getPending: getPendingExpenses,
        markSynced: markExpenseAsSynced,
        markError: markExpenseSyncError,
        toPayload: (rec) => ({
            id: (rec as CachedExpense).id,
            category: (rec as CachedExpense).category,
            amount: (rec as CachedExpense).amount,
            description: (rec as CachedExpense).description,
            date: (rec as CachedExpense).date,
            createdAt: (rec as CachedExpense).createdAt,
        }),
        endpoint: '/api/expenses/sync-batch',
    })
}
