import { addExpenseLocal, getPendingExpenses, markExpenseAsSynced, markExpenseSyncError, CachedExpense } from './indexedDb'
import { fetchJSON } from '@/lib/utils/http'

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
 * Sync expense to server (if online)
 */
export async function syncExpenseToServer(expense: CachedExpense): Promise<boolean> {
    try {
        await fetchJSON('/api/expenses', {
            method: 'POST',
            body: JSON.stringify({
                category: expense.category,
                amount: expense.amount,
                description: expense.description,
                date: new Date(expense.date).toISOString(),
                createdAt: new Date(expense.createdAt).toISOString(),
            }),
        })

        await markExpenseAsSynced(expense.id)
        return true
    } catch (error: any) {
        await markExpenseSyncError(expense.id, error.message || 'Sync failed')
        console.error('Error syncing expense:', error)
        return false
    }
}

/**
 * Save expense locally and sync if online
 */
export async function saveExpense(expense: ExpenseInput, isOnline: boolean): Promise<{ saved: boolean; synced: boolean }> {
    // Always save locally first (offline-first)
    await saveExpenseLocally(expense)

    // Try to sync if online
    if (isOnline) {
        const cachedExpense = await getPendingExpenses(expense.shopId).then((expenses) =>
            expenses.find((e) => e.id === expense.id)
        )
        if (cachedExpense) {
            const synced = await syncExpenseToServer(cachedExpense)
            return { saved: true, synced }
        }
    }

    return { saved: true, synced: false }
}
