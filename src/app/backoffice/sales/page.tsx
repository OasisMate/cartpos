'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { Table, THead, TR, TH, TD, EmptyRow } from '@/components/ui/DataTable'
import EmptyState from '@/components/ui/EmptyState'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import IconButton from '@/components/ui/IconButton'
import { Printer, Ban, Trash2, Undo2, Pencil } from 'lucide-react'
import ReceiptModal from '@/components/receipt/ReceiptModal'
import ReturnModal from '@/components/returns/ReturnModal'
import { BrandSpinner } from '@/components/ui/BrandSpinner'

interface SaleLine {
  id: string
  product: { id: string; name: string; unit: string }
  quantity: string
  unitPrice: string
  lineTotal: string
}

interface Sale {
  id: string
  number: string | null
  createdAt: string
  status: 'COMPLETED' | 'VOID'
  paymentStatus: 'PAID' | 'UDHAAR'
  paymentMethod: 'CASH' | 'CARD' | 'OTHER' | null
  total: string
  customer: { id: string; name: string } | null
  lines: SaleLine[]
  payments: Array<{ id: string; amount: string; method: string }>
  createdBy: { id: string; name: string } | null
  canEdit?: boolean
  editBlockReason?: string | null
}

interface SalesResponse {
  sales: Sale[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

export default function BackofficeSalesPage() {
  const { user } = useAuth()
  const router = useRouter()
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
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [voidModalOpen, setVoidModalOpen] = useState(false)
  const [saleToVoid, setSaleToVoid] = useState<Sale | null>(null)
  const [voiding, setVoiding] = useState(false)
  const [receiptModalOpen, setReceiptModalOpen] = useState(false)
  const [receiptInvoice, setReceiptInvoice] = useState<any>(null)
  const [returnSaleId, setReturnSaleId] = useState<string | null>(null)

  const isManager =
    user?.role === 'PLATFORM_ADMIN' ||
    user?.shops?.some((s) => s.shopId === user.currentShopId && s.shopRole === 'STORE_MANAGER') ||
    user?.organizations?.some((o) => o.orgId === user.currentOrgId && o.orgRole === 'ORG_ADMIN')

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
          if (debouncedSearch) {
            params.set('search', debouncedSearch)
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
        number: (s as any).number ?? null,
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

      // Apply search (invoice number or customer name) on cached rows
      if (debouncedSearch) {
        const term = debouncedSearch.toLowerCase()
        rows = rows.filter(
          (s) =>
            (s.number && s.number.toLowerCase().includes(term)) ||
            (s.customer?.name && s.customer.name.toLowerCase().includes(term))
        )
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
  }, [user?.currentShopId, currentPage, statusFilter, debouncedSearch])

  // Debounce the search box: wait 300ms after typing, then search from page 1.
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim())
      setCurrentPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [searchTerm])

  useEffect(() => {
    fetchSales()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.currentShopId])

  useEffect(() => {
    fetchSales()
  }, [fetchSales])

  function openVoidModal(sale: Sale) {
    setSaleToVoid(sale)
    setVoidModalOpen(true)
  }

  async function handleVoid(alsoDelete: boolean = false) {
    if (!saleToVoid || voiding) return
    
    try {
      setError('')
      setVoiding(true)
      
      // Void the sale
      const resp = await fetch(`/api/sales/${saleToVoid.id}/void`, { method: 'POST' })
      const data = await resp.json()
      if (!resp.ok) {
        throw new Error(data.error || 'Failed to void sale')
      }
      
      // If also delete, delete it immediately after voiding
      if (alsoDelete) {
        const deleteResp = await fetch(`/api/sales/${saleToVoid.id}`, { method: 'DELETE' })
        const deleteData = await deleteResp.json()
        if (!deleteResp.ok) {
          throw new Error(deleteData.error || 'Failed to delete sale')
        }
      }
      
      // Close modal only after operation completes
      setVoidModalOpen(false)
      
      // Optimistic update: update local state immediately
      if (alsoDelete) {
        setSales(prev => prev.filter(s => s.id !== saleToVoid.id))
        setPagination(prev => ({ ...prev, total: prev.total - 1 }))
      } else {
        setSales(prev => prev.map(s => 
          s.id === saleToVoid.id ? { ...s, status: 'VOID' as const } : s
        ))
      }
      
      // Refresh in background to ensure consistency
      fetchSales().catch(err => console.error('Background refresh failed:', err))
      
      setSaleToVoid(null)
    } catch (err: any) {
      setError(err.message || 'Failed to void sale')
    } finally {
      setVoiding(false)
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
      
      // Optimistic update
      setSales(prev => prev.filter(s => s.id !== id))
      setPagination(prev => ({ ...prev, total: prev.total - 1 }))
      
      // Refresh in background
      fetchSales().catch(err => console.error('Background refresh failed:', err))
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
      <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold">Sales</h1>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search invoice no. or customer..."
            className="px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-64"
          />
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
      </div>

      {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">{error}</div>}

      {loading ? (
        <div className="text-center py-8">Loading...</div>
      ) : sales.length === 0 ? (
        <EmptyState title="No sales found" description="Completed sales will appear here." />
      ) : (
        <>
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <TR>
                  <TH>Invoice #</TH>
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
                  <EmptyRow colSpan={7} message="No sales found" />
                ) : (
                  sales.map((s) => (
                    <TR key={s.id}>
                      <TD className="font-medium">{s.number || '-'}</TD>
                      <TD>{new Date(s.createdAt).toLocaleString()}</TD>
                      <TD>{s.customer?.name || '-'}</TD>
                      <TD>
                        {s.paymentStatus === 'PAID' ? `PAID (${s.paymentMethod || 'CASH'})` : 'UDHAAR'}
                      </TD>
                      <TD className="text-right">Rs {Number(s.total).toFixed(2)}</TD>
                      <TD>{s.status}</TD>
                      <TD className="text-center">
                      <div className="flex justify-center gap-2">
                        <IconButton
                          variant="neutral"
                          label="Print receipt"
                          onClick={async () => {
                            try {
                              const response = await fetch(`/api/sales/${s.id}`)
                              if (response.ok) {
                                const data = await response.json()
                                setReceiptInvoice(data.invoice)
                                setReceiptModalOpen(true)
                              }
                            } catch (err) {
                              console.error('Failed to load receipt:', err)
                            }
                          }}
                        >
                          <Printer className="h-4 w-4" />
                        </IconButton>
                        {s.canEdit && (
                          <IconButton
                            variant="neutral"
                            label="Edit sale"
                            onClick={() => router.push(`/store/pos?edit=${s.id}`)}
                          >
                            <Pencil className="h-4 w-4" />
                          </IconButton>
                        )}
                        {isManager && s.status !== 'VOID' && (
                          <IconButton variant="neutral" label="Return / refund" onClick={() => setReturnSaleId(s.id)}>
                            <Undo2 className="h-4 w-4" />
                          </IconButton>
                        )}
                        {s.status === 'VOID' ? (
                          <IconButton variant="danger" label="Delete voided sale" onClick={() => deleteSale(s.id)}>
                            <Trash2 className="h-4 w-4" />
                          </IconButton>
                        ) : (
                          <IconButton variant="danger" label="Void sale" onClick={() => openVoidModal(s)}>
                            <Ban className="h-4 w-4" />
                          </IconButton>
                        )}
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
                <Button
                  variant="outline"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <span className="px-4 py-2">
                  Page {currentPage} of {pagination.totalPages}
                </span>
                <Button
                  variant="outline"
                  onClick={() => setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))}
                  disabled={currentPage === pagination.totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Void Modal */}
      <Modal
        open={voidModalOpen && !!saleToVoid}
        onClose={() => {
          if (!voiding) {
            setVoidModalOpen(false)
            setSaleToVoid(null)
          }
        }}
        title="Void Sale"
      >
        {voiding ? (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="mb-4">
              <BrandSpinner size={48} />
            </div>
            <p className="text-gray-700 text-center">
              Processing... Please wait
            </p>
          </div>
        ) : (
          <>
            <p className="text-gray-700 mb-6">
              Are you sure you want to void this sale? This will reverse stock and ledger entries.
            </p>
            <div className="space-y-3">
              <Button variant="danger" onClick={() => handleVoid(true)} disabled={voiding} className="w-full">
                Void and Delete
              </Button>
              <Button variant="primary" onClick={() => handleVoid(false)} disabled={voiding} className="w-full">
                Only Void
              </Button>
              <Button variant="outline" onClick={() => { setVoidModalOpen(false); setSaleToVoid(null) }} disabled={voiding} className="w-full">
                Cancel
              </Button>
            </div>
          </>
        )}
      </Modal>

      {/* Return / Refund / Exchange Modal */}
      {returnSaleId && (
        <ReturnModal
          saleId={returnSaleId}
          isOpen={!!returnSaleId}
          onClose={() => setReturnSaleId(null)}
          onDone={() => fetchSales()}
        />
      )}

      {/* Receipt Modal */}
      {receiptModalOpen && receiptInvoice && (
        <ReceiptModal
          isOpen={receiptModalOpen}
          onClose={() => {
            setReceiptModalOpen(false)
            setReceiptInvoice(null)
          }}
          invoice={receiptInvoice}
          printElementId="sales-receipt-print"
        />
      )}
    </div>
  )
}

