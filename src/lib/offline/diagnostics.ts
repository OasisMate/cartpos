import {
  getPendingSales, getPendingPurchases, getPendingCustomers,
  getPendingUdhaarPayments, getPendingExpenses, getPendingStockAdjustments,
  getCustomers,
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
  records: Record<string, Array<{
    id: string
    createdAt?: number
    syncStatus?: string
    syncError?: string
    detail?: unknown
  }>>
  counts: Record<string, number>
}

export async function buildSyncDiagnostics(
  shopId: string,
  ctx: { orgId?: string; userId?: string }
): Promise<SyncDiagnostics> {
  const [sales, purchases, customers, payments, expenses, adjustments, allCustomers] = await Promise.all([
    getPendingSales(shopId), getPendingPurchases(shopId), getPendingCustomers(shopId),
    getPendingUdhaarPayments(shopId), getPendingExpenses(shopId), getPendingStockAdjustments(shopId),
    getCustomers(shopId),
  ])

  // Resolve customer ids to names so a stuck sale/payment is recognisable (name is included by
  // choice; phone/notes/descriptions stay as present/empty flags so no extra PII leaves the shop).
  const custById = new Map(allCustomers.map((c) => [c.id, c]))
  const custName = (id?: string) => (id ? custById.get(id)?.name ?? null : null)

  let truncated = false
  const cap = <T,>(arr: T[]) => {
    if (arr.length > MAX_PER_TYPE) { truncated = true; return arr.slice(0, MAX_PER_TYPE) }
    return arr
  }

  const records = {
    sales: cap(sales).map((s: any) => ({
      id: s.id, createdAt: s.createdAt, syncStatus: s.syncStatus, syncError: s.syncError,
      detail: {
        total: s.total, subtotal: s.subtotal, discount: s.discount,
        serviceCharge: s.serviceCharge, deliveryCharge: s.deliveryCharge,
        paymentStatus: s.paymentStatus, paymentMethod: s.paymentMethod,
        amountReceived: s.amountReceived, paidNow: s.paidNow,
        customerId: s.customerId || null, customerName: custName(s.customerId),
        items: (s.items || []).map((i: any) => ({
          productId: i.productId, quantity: i.quantity, unitPrice: i.unitPrice,
          lineTotal: i.lineTotal, unitsPerItem: i.unitsPerItem, packName: i.packName,
        })),
      },
    })),
    purchases: cap(purchases).map((p: any) => ({
      id: p.id, createdAt: p.createdAt, syncStatus: p.syncStatus, syncError: p.syncError,
      detail: {
        supplierId: p.supplierId || null, onCredit: p.onCredit, date: p.date,
        hasReference: !!p.reference, hasNotes: !!p.notes,
        lines: (p.lines || []).map((l: any) => ({
          productId: l.productId, quantity: l.quantity, unitCost: l.unitCost,
          hasLotNo: !!l.lotNo, expiry: l.expiry ?? null,
        })),
      },
    })),
    customers: cap(customers).map((c: any) => ({
      id: c.id, createdAt: c.updatedAt, syncStatus: c.syncStatus, syncError: c.syncError,
      detail: {
        name: c.name, hasPhone: !!c.phone, hasNotes: !!c.notes,
        isLocalOnly: !!c.isLocalOnly, balance: c.balance ?? null,
      },
    })),
    udhaarPayments: cap(payments).map((p: any) => ({
      id: p.id, createdAt: p.createdAt, syncStatus: p.syncStatus, syncError: p.syncError,
      detail: {
        amount: p.amount, method: p.method,
        customerId: p.customerId || null, customerName: custName(p.customerId),
        hasNote: !!p.note,
      },
    })),
    expenses: cap(expenses).map((e: any) => ({
      id: e.id, createdAt: e.createdAt, syncStatus: e.syncStatus, syncError: e.syncError,
      detail: { amount: e.amount, category: e.category, date: e.date, hasDescription: !!e.description },
    })),
    stockAdjustments: cap(adjustments).map((a: any) => ({
      id: a.id, createdAt: a.createdAt, syncStatus: a.syncStatus, syncError: a.syncError,
      detail: { productId: a.productId, quantity: a.quantity, type: a.type, hasNotes: !!a.notes },
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
