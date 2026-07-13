import {
  getPendingSales, getPendingPurchases, getPendingCustomers,
  getPendingUdhaarPayments, getPendingExpenses, getPendingStockAdjustments,
} from './indexedDb'
import { getLastAttemptStatuses } from './sync'

const MAX_PER_TYPE = 200

export interface SyncDiagnostics {
  generatedAt: number
  userAgent: string
  online: boolean
  shopId: string
  orgId?: string
  userId?: string
  lastAttempt: Record<string, number>
  truncated: boolean
  records: Record<string, Array<{ id: string; createdAt?: number; syncError?: string; detail?: unknown }>>
  counts: Record<string, number>
}

export async function buildSyncDiagnostics(
  shopId: string,
  ctx: { orgId?: string; userId?: string }
): Promise<SyncDiagnostics> {
  const [sales, purchases, customers, payments, expenses, adjustments] = await Promise.all([
    getPendingSales(shopId), getPendingPurchases(shopId), getPendingCustomers(shopId),
    getPendingUdhaarPayments(shopId), getPendingExpenses(shopId), getPendingStockAdjustments(shopId),
  ])

  let truncated = false
  const cap = <T,>(arr: T[]) => {
    if (arr.length > MAX_PER_TYPE) { truncated = true; return arr.slice(0, MAX_PER_TYPE) }
    return arr
  }

  // PII-free: never include customer name/phone/notes or free-text descriptions.
  const records = {
    sales: cap(sales).map((s: any) => ({
      id: s.id, createdAt: s.createdAt, syncError: s.syncError,
      // customerId is an id (not PII) and is essential for diagnosing udhaar sync failures.
      detail: {
        total: s.total, paymentStatus: s.paymentStatus, customerId: s.customerId || null,
        productIds: (s.items || []).map((i: any) => i.productId),
      },
    })),
    purchases: cap(purchases).map((p: any) => ({
      id: p.id, createdAt: p.createdAt, syncError: p.syncError,
      detail: { productIds: (p.lines || []).map((l: any) => l.productId) },
    })),
    customers: cap(customers).map((c: any) => ({ id: c.id, createdAt: c.updatedAt, syncError: c.syncError })),
    udhaarPayments: cap(payments).map((p: any) => ({
      id: p.id, createdAt: p.createdAt, syncError: p.syncError,
      detail: { amount: p.amount, method: p.method, customerId: p.customerId },
    })),
    expenses: cap(expenses).map((e: any) => ({
      id: e.id, createdAt: e.createdAt, syncError: e.syncError, detail: { amount: e.amount, category: e.category },
    })),
    stockAdjustments: cap(adjustments).map((a: any) => ({
      id: a.id, createdAt: a.createdAt, syncError: a.syncError,
      detail: { productId: a.productId, quantity: a.quantity, type: a.type },
    })),
  }

  const counts = {
    sales: sales.length, purchases: purchases.length, customers: customers.length,
    udhaarPayments: payments.length, expenses: expenses.length, stockAdjustments: adjustments.length,
  }

  return {
    generatedAt: Date.now(),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    online: typeof navigator !== 'undefined' ? navigator.onLine : true,
    shopId, orgId: ctx.orgId, userId: ctx.userId,
    lastAttempt: getLastAttemptStatuses(),
    truncated, records, counts,
  }
}
