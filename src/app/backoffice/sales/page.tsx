'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { Table, THead, TR, TH, TD, EmptyRow } from '@/components/ui/DataTable'

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
            <Table>
              <THead>
                <TR>
                  <TH>Date</TH>
                  <TH>Customer</TH>
                  <TH>Payment</TH>
                  <TH className="text-right">Total</TH>
                  <TH>Status</TH>
                  <TH className="text-center">Actions</TH>
                </TR>
              </THead>
              <tbody>
                {sales.length === 0 ? (
                  <EmptyRow colSpan={6} message="No sales found" />
                ) : (
                  sales.map((s) => (
                    <TR key={s.id}>
                      <TD>{new Date(s.createdAt).toLocaleString()}</TD>
                      <TD>{s.customer?.name || '-'}</TD>
                      <TD>
                        {s.paymentStatus === 'PAID' ? `PAID (${s.paymentMethod || 'CASH'})` : 'UDHAAR'}
                      </TD>
                      <TD className="text-right">Rs {Number(s.total).toFixed(2)}</TD>
                      <TD>{s.status}</TD>
                      <TD className="text-center">
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={async () => {
                            const { printReceipt } = await import('@/lib/utils/print')
                            try {
                              const response = await fetch(`/api/sales/${s.id}`)
                              if (response.ok) {
                                const data = await response.json()
                                const inv = data.invoice
                                const tempDiv = document.createElement('div')
                                tempDiv.id = 'temp-receipt-' + Date.now()
                                tempDiv.style.cssText = 'position:fixed;left:-9999px'
                                const dateStr = new Date(inv.createdAt).toLocaleDateString('en-GB').replace(/\//g, '-')
                                const timeStr = new Date(inv.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
                                tempDiv.innerHTML = `
                                  <div class="shop-name">${inv.shop?.name || 'Shop'}</div>
                                  ${inv.shop?.city ? `<div class="shop-address">${inv.shop.city}</div>` : ''}
                                  ${inv.shop?.phone ? `<div class="shop-phone">${inv.shop.phone}</div>` : ''}
                                  <div class="sale-invoice">Sale Invoice</div>
                                  <div class="info-grid">
                                    <div class="info-row">
                                      <div class="info-col"><span class="label">Inv #:</span><span>${inv.number || inv.id.slice(0, 8)}</span></div>
                                      <div class="info-col"><span class="label">Date:</span><span>${dateStr}</span></div>
                                    </div>
                                    <div class="info-row">
                                      <div class="info-col"><span class="label">M.O.P:</span><span>${inv.paymentStatus === 'PAID' ? (inv.paymentMethod || 'Cash') : 'UDHAAR'}</span></div>
                                      <div class="info-col"><span class="label">Time:</span><span>${timeStr}</span></div>
                                    </div>
                                  </div>
                                  <div class="divider"></div>
                                  <table>
                                    <thead><tr><th>Sr#</th><th>Item Details</th><th class="price">Price</th><th class="qty">Qty</th><th class="total">Total</th></tr></thead>
                                    <tbody>
                                      ${inv.lines.map((l: any, i: number) => `<tr><td class="sn">${i+1}</td><td class="item-name">${l.product.name}</td><td class="price">${Number(l.unitPrice).toFixed(0)}</td><td class="qty">${Number(l.quantity).toFixed(0)}</td><td class="total">${Number(l.lineTotal).toFixed(0)}</td></tr>`).join('')}
                                    </tbody>
                                  </table>
                                  <div class="divider"></div>
                                  <div class="summary">
                                    ${Number(inv.discount) > 0 ? `<div class="summary-row"><span>Subtotal:</span><span>${Number(inv.subtotal).toFixed(0)}</span></div><div class="summary-row"><span>Discount:</span><span>-${Number(inv.discount).toFixed(0)}</span></div>` : ''}
                                    <div class="summary-row total"><span>Grand Total:</span><span>${Number(inv.total).toFixed(0)}</span></div>
                                    ${inv.paymentStatus === 'PAID' && inv.paymentMethod === 'CASH' && inv.payments && inv.payments.length > 0 ? `<div class="summary-row"><span>Cash Paid:</span><span>${Number(inv.payments[0]?.amount || inv.total).toFixed(0)}</span></div>` : ''}
                                  </div>
                                  <div class="footer">
                                    <div class="footer-row"><span>Total Items:</span><span>${inv.lines.length}</span></div>
                                    <div style="text-align:center;margin-top:1mm">Shukriya! Visit again.</div>
                                  </div>
                                `
                                document.body.appendChild(tempDiv)
                                printReceipt(tempDiv.id, { silent: true })
                                setTimeout(() => tempDiv.remove(), 2000)
                              }
                            } catch (err) {
                              console.error('Print failed:', err)
                            }
                          }}
                          className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
                          title="Print receipt"
                        >
                          Print
                        </button>
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
                      </TD>
                    </TR>
                  ))
                )}
              </tbody>
            </Table>
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

