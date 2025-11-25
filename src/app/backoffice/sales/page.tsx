'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useConfirm } from '@/components/ui/ConfirmDialog'

interface SaleLine {
  id: string
  product: { id: string; name: string; unit: string }
  quantity: string
  unitPrice: string
  lineTotal: string
}

interface Sale {
  id: string
  createdAt: string
  status: 'COMPLETED' | 'VOID'
  paymentStatus: 'PAID' | 'UDHAAR'
  paymentMethod: 'CASH' | 'CARD' | 'OTHER' | null
  total: string
  customer: { id: string; name: string } | null
  lines: SaleLine[]
  payments: Array<{ id: string; amount: string; method: string }>
  createdBy: { id: string; name: string } | null
}

interface SalesResponse {
  sales: Sale[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

export default function BackofficeSalesPage() {
  const { user } = useAuth()
  const { confirm, ConfirmDialog } = useConfirm()
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 1,
  })
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PAID' | 'UDHAAR'>('ALL')

  const fetchSales = useCallback(async () => {
    if (!user?.currentShopId) return
    try {
      setLoading(true)
      setError('')
      
      // Try API first if online
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        try {
          const params = new URLSearchParams({
            page: currentPage.toString(),
            limit: '50',
          })
          if (statusFilter !== 'ALL') {
            params.set('paymentStatus', statusFilter)
          }
          const resp = await fetch(`/api/sales?${params}`)
          const data: SalesResponse = await resp.json()
          if (resp.ok) {
            setSales(data.sales || [])
            setPagination(data.pagination)
            setLoading(false)
            return
          }
        } catch (apiError) {
          console.warn('API failed, falling back to cache:', apiError)
        }
      }
      
      // Offline or API failed: use cached sales
      const { getSales } = await import('@/lib/offline/indexedDb')
      const cached = await getSales(user.currentShopId)
      let rows = cached.map((s) => ({
        id: s.id,
        createdAt: new Date(s.createdAt).toISOString(),
        status: 'COMPLETED' as const,
        paymentStatus: s.paymentStatus,
        paymentMethod: s.paymentMethod ?? null,
        total: s.total.toString(),
        customer: s.customerId ? { id: s.customerId, name: 'Customer' } : null,
        lines: s.items.map((item) => ({
          id: item.productId,
          product: { id: item.productId, name: 'Product', unit: 'pcs' },
          quantity: item.quantity.toString(),
          unitPrice: item.unitPrice.toString(),
          lineTotal: item.lineTotal.toString(),
        })),
        payments: s.paymentStatus === 'PAID' && s.amountReceived ? [{
          id: s.id,
          amount: s.amountReceived.toString(),
          method: s.paymentMethod || 'CASH',
        }] : [],
        createdBy: null,
      }))
      
      // Apply payment status filter
      if (statusFilter !== 'ALL') {
        rows = rows.filter((s) => s.paymentStatus === statusFilter)
      }
      
      setSales(rows)
      setPagination({
        page: 1,
        limit: 50,
        total: rows.length,
        totalPages: 1,
      })
    } catch (err: any) {
      setError(err.message || 'Failed to load sales')
    } finally {
      setLoading(false)
    }
  }, [user?.currentShopId, currentPage, statusFilter])

  useEffect(() => {
    fetchSales()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.currentShopId])

  useEffect(() => {
    fetchSales()
  }, [fetchSales])

  async function voidSale(id: string) {
    const agreed = await confirm('Are you sure you want to VOID this sale? This will reverse stock and ledger entries.')
    if (!agreed) return
    try {
      setError('')
      const resp = await fetch(`/api/sales/${id}/void`, { method: 'POST' })
      const data = await resp.json()
      if (!resp.ok) {
        throw new Error(data.error || 'Failed to void sale')
      }
      await fetchSales()
    } catch (err: any) {
      setError(err.message || 'Failed to void sale')
    }
  }

  async function deleteSale(id: string) {
    const agreed = await confirm('Delete this sale permanently? This cannot be undone.')
    if (!agreed) return
    try {
      setError('')
      const resp = await fetch(`/api/sales/${id}`, { method: 'DELETE' })
      const data = await resp.json()
      if (!resp.ok) {
        throw new Error(data.error || 'Failed to delete sale')
      }
      await fetchSales()
    } catch (err: any) {
      setError(err.message || 'Failed to delete sale')
    }
  }

  if (!user?.currentShopId) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Sales</h1>
        <p className="text-gray-600">Please select a shop first</p>
      </div>
    )
  }

  return (
    <div className="p-6">
      <ConfirmDialog />
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Sales</h1>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-700">Payment</label>
          <select
            value={statusFilter}
            onChange={(e) => {
              setCurrentPage(1)
              setStatusFilter(e.target.value as any)
            }}
            className="px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">All</option>
            <option value="PAID">Paid</option>
            <option value="UDHAAR">Udhaar</option>
          </select>
        </div>
      </div>

      {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">{error}</div>}

      {loading ? (
        <div className="text-center py-8">Loading...</div>
      ) : sales.length === 0 ? (
        <div className="text-center py-8 text-gray-600">No sales found.</div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border p-2 text-left">Date</th>
                  <th className="border p-2 text-left">Customer</th>
                  <th className="border p-2 text-left">Payment</th>
                  <th className="border p-2 text-right">Total</th>
                  <th className="border p-2 text-left">Status</th>
                  <th className="border p-2 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="border p-2">
                      {new Date(s.createdAt).toLocaleString()}
                    </td>
                    <td className="border p-2">{s.customer?.name || '-'}</td>
                    <td className="border p-2">
                      {s.paymentStatus === 'PAID' ? `PAID (${s.paymentMethod || 'CASH'})` : 'UDHAAR'}
                    </td>
                    <td className="border p-2 text-right">Rs {Number(s.total).toFixed(2)}</td>
                    <td className="border p-2">{s.status}</td>
                    <td className="border p-2 text-center">
                      <div className="flex justify-center gap-2">
                        <a
                          href={`/store/sales/${s.id}/receipt`}
                          target="_blank"
                          className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
                          title="Print receipt"
                        >
                          Print
                        </a>
                        <button
                          disabled={s.status === 'VOID'}
                          onClick={() => voidSale(s.id)}
                          className="px-3 py-1 text-sm border rounded disabled:opacity-50 hover:bg-gray-50"
                          title={s.status === 'VOID' ? 'Already voided' : 'Void sale'}
                        >
                          Void
                        </button>
                        <button
                          onClick={() => deleteSale(s.id)}
                          className="px-3 py-1 text-sm border border-red-200 text-red-600 rounded hover:bg-red-50"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pagination.totalPages > 1 && (
            <div className="mt-4 flex justify-between items-center">
              <div className="text-sm text-gray-600">
                Showing {sales.length} of {pagination.total} sales
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Previous
                </button>
                <span className="px-4 py-2">
                  Page {currentPage} of {pagination.totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))}
                  disabled={currentPage === pagination.totalPages}
                  className="px-4 py-2 border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

