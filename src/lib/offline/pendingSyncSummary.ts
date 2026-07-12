import {
  getPendingSales,
  getPendingPurchases,
  getPendingCustomers,
  getPendingUdhaarPayments,
  getPendingExpenses,
  getPendingStockAdjustments,
} from './indexedDb'

export type PendingSyncSummary = {
  total: number
  sales: number
  purchases: number
  customers: number
  udhaarPayments: number
  expenses: number
  stockAdjustments: number
  /** Last stored sync error on any pending record, so the banner can say why it is stuck. */
  firstError?: string
}

export async function getPendingSyncSummary(shopId: string | undefined): Promise<PendingSyncSummary> {
  if (!shopId) {
    return { total: 0, sales: 0, purchases: 0, customers: 0, udhaarPayments: 0, expenses: 0, stockAdjustments: 0 }
  }

  const [sales, purchases, customers, udhaarPayments, expenses, stockAdjustments] = await Promise.all([
    getPendingSales(shopId),
    getPendingPurchases(shopId),
    getPendingCustomers(shopId),
    getPendingUdhaarPayments(shopId),
    getPendingExpenses(shopId),
    getPendingStockAdjustments(shopId),
  ])

  const firstError =
    sales.find((r) => r.syncError)?.syncError ||
    purchases.find((r) => r.syncError)?.syncError ||
    udhaarPayments.find((r) => r.syncError)?.syncError ||
    expenses.find((r) => r.syncError)?.syncError ||
    stockAdjustments.find((r) => r.syncError)?.syncError

  return {
    sales: sales.length,
    purchases: purchases.length,
    customers: customers.length,
    udhaarPayments: udhaarPayments.length,
    expenses: expenses.length,
    stockAdjustments: stockAdjustments.length,
    total:
      sales.length +
      purchases.length +
      customers.length +
      udhaarPayments.length +
      expenses.length +
      stockAdjustments.length,
    firstError,
  }
}

export function formatPendingSyncLabel(s: PendingSyncSummary): string {
  if (s.total === 0) return ''
  const parts: string[] = []
  if (s.sales) parts.push(`${s.sales} sale${s.sales === 1 ? '' : 's'}`)
  if (s.purchases) parts.push(`${s.purchases} purchase${s.purchases === 1 ? '' : 's'}`)
  if (s.customers) parts.push(`${s.customers} customer${s.customers === 1 ? '' : 's'}`)
  if (s.udhaarPayments) parts.push(`${s.udhaarPayments} payment${s.udhaarPayments === 1 ? '' : 's'}`)
  if (s.expenses) parts.push(`${s.expenses} expense${s.expenses === 1 ? '' : 's'}`)
  if (s.stockAdjustments) parts.push(`${s.stockAdjustments} adjustment${s.stockAdjustments === 1 ? '' : 's'}`)
  return parts.join(' · ')
}
