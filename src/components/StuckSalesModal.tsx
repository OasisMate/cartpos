'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  getStuckUdhaarSales,
  getCustomers,
  attachCustomerToStuckSale,
  convertStuckSaleToPaidCash,
  deleteSale,
  CachedSale,
  CachedCustomer,
} from '@/lib/offline/indexedDb'
import { runAllSyncTasks } from '@/lib/offline/orchestrator'
import { X, Loader2 } from 'lucide-react'

type Props = {
  shopId: string
  onClose: () => void
  /** Called after any change so the banner can refresh its counts. */
  onChanged?: () => void
}

/**
 * Device-local recovery for udhaar (credit) sales that got saved without a customer and can
 * never sync. The sale data (items, amount, date) is safe on the device; the shopkeeper just
 * needs to say who owes it, mark it paid, or discard it. Then it syncs.
 */
export function StuckSalesModal({ shopId, onClose, onChanged }: Props) {
  const [sales, setSales] = useState<CachedSale[]>([])
  const [customers, setCustomers] = useState<CachedCustomer[]>([])
  const [picked, setPicked] = useState<Record<string, string>>({})
  const [busyId, setBusyId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [confirmDiscardId, setConfirmDiscardId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [stuck, custs] = await Promise.all([getStuckUdhaarSales(shopId), getCustomers(shopId)])
      stuck.sort((a, b) => a.createdAt - b.createdAt)
      custs.sort((a, b) => a.name.localeCompare(b.name))
      setSales(stuck)
      setCustomers(custs)
    } catch {
      setError('Could not read local sales on this device.')
    } finally {
      setLoading(false)
    }
  }, [shopId])

  useEffect(() => {
    void load()
  }, [load])

  async function afterChange() {
    onChanged?.()
    // Push the newly-fixed records to the server right away.
    try {
      await runAllSyncTasks(shopId)
    } catch {
      /* offline or failed - the record stays PENDING and retries later */
    }
    await load()
    onChanged?.()
  }

  async function handleAttach(sale: CachedSale) {
    const customerId = picked[sale.id]
    if (!customerId) {
      setError('Pick a customer for this sale first.')
      return
    }
    setBusyId(sale.id)
    setError(null)
    try {
      await attachCustomerToStuckSale(sale.id, customerId)
      await afterChange()
    } catch {
      setError('Could not update the sale. Try again.')
    } finally {
      setBusyId(null)
    }
  }

  async function handleMarkPaid(sale: CachedSale) {
    setBusyId(sale.id)
    setError(null)
    try {
      await convertStuckSaleToPaidCash(sale.id)
      await afterChange()
    } catch {
      setError('Could not update the sale. Try again.')
    } finally {
      setBusyId(null)
    }
  }

  async function handleDiscard(sale: CachedSale) {
    setBusyId(sale.id)
    setError(null)
    try {
      await deleteSale(sale.id)
      setConfirmDiscardId(null)
      await afterChange()
    } catch {
      setError('Could not discard the sale. Try again.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-3">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-[hsl(var(--border))] p-4">
          <div>
            <h2 className="text-lg font-bold">Fix stuck credit sales</h2>
            <p className="mt-0.5 text-sm text-[hsl(var(--muted-foreground))]">
              These udhaar sales have no customer, so they cannot sync. Pick who owes each one, mark it
              paid, or discard it. Nothing is lost until you discard.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {error ? (
            <p className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          ) : null}

          {loading ? (
            <p className="py-8 text-center text-sm text-[hsl(var(--muted-foreground))]">Loading…</p>
          ) : sales.length === 0 ? (
            <p className="py-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
              No stuck credit sales. You are all caught up.
            </p>
          ) : (
            <ul className="space-y-3">
              {sales.map((sale) => {
                const busy = busyId === sale.id
                const itemCount = (sale.items || []).reduce((n, i) => n + (i.quantity || 0), 0)
                const date = new Date(sale.createdAt).toLocaleString()
                return (
                  <li key={sale.id} className="rounded-lg border border-[hsl(var(--border))] p-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-semibold">Rs {Number(sale.total).toLocaleString()}</span>
                      <span className="text-xs text-[hsl(var(--muted-foreground))]">
                        {itemCount} item{itemCount === 1 ? '' : 's'} · {date}
                      </span>
                    </div>

                    {confirmDiscardId === sale.id ? (
                      <div className="mt-3 rounded border border-red-200 bg-red-50 p-2">
                        <p className="text-sm text-red-800">
                          Discard this sale for good? This deletes it from the device and it will never sync.
                        </p>
                        <div className="mt-2 flex gap-2">
                          <button
                            type="button"
                            className="btn h-8 border border-red-300 px-3 text-sm text-red-700 hover:bg-red-100 disabled:opacity-50"
                            disabled={busy}
                            onClick={() => void handleDiscard(sale)}
                          >
                            {busy ? 'Discarding…' : 'Yes, discard'}
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost h-8 px-3 text-sm"
                            disabled={busy}
                            onClick={() => setConfirmDiscardId(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                        <select
                          className="input h-9 flex-1 text-sm"
                          value={picked[sale.id] || ''}
                          disabled={busy}
                          onChange={(e) => setPicked((p) => ({ ...p, [sale.id]: e.target.value }))}
                        >
                          <option value="">Select customer…</option>
                          {customers.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                              {c.phone ? ` (${c.phone})` : ''}
                            </option>
                          ))}
                        </select>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="btn btn-primary h-9 px-3 text-sm disabled:opacity-50"
                            disabled={busy || !picked[sale.id]}
                            onClick={() => void handleAttach(sale)}
                          >
                            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Attach & sync'}
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost h-9 whitespace-nowrap px-3 text-sm disabled:opacity-50"
                            disabled={busy}
                            onClick={() => void handleMarkPaid(sale)}
                            title="This sale was actually paid in cash"
                          >
                            Mark paid
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost h-9 px-3 text-sm text-red-600 disabled:opacity-50"
                            disabled={busy}
                            onClick={() => setConfirmDiscardId(sale.id)}
                          >
                            Discard
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="border-t border-[hsl(var(--border))] p-3 text-right">
          <button type="button" className="btn btn-ghost h-9 px-4 text-sm" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
