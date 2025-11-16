'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { savePurchaseLocally, syncPendingPurchasesBatch } from '@/lib/offline/purchases'
import { cuid } from '@/lib/utils/cuid'

interface Product {
  id: string
  name: string
  unit: string
  price: string
}

interface Supplier {
  id: string
  name: string
}

interface PurchaseLine {
  productId: string
  quantity: string
  unitCost: string
}

interface Purchase {
  id: string
  date: string
  reference: string | null
  notes: string | null
  supplier: Supplier | null
  createdBy: {
    id: string
    name: string
  } | null
  _count: {
    lines: number
  }
  lines: Array<{
    id: string
    product: {
      id: string
      name: string
      unit: string
    }
    quantity: string
    unitCost: string | null
  }>
}

interface PurchasesResponse {
  purchases: Purchase[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export default function PurchasesPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 1,
  })
  const [formData, setFormData] = useState({
    supplierId: '',
    date: new Date().toISOString().split('T')[0],
    reference: '',
    notes: '',
    lines: [] as PurchaseLine[],
  })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Per-page sync removed; handled by global background sync orchestrator

  const fetchPurchases = useCallback(async () => {
    if (!user?.currentShopId) return

    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '50',
      })

      const response = await fetch(`/api/purchases?${params}`)
      if (response.ok) {
        const data: PurchasesResponse = await response.json()
        setPurchases(data.purchases || [])
        setPagination(data.pagination)
      }
    } catch (err) {
      console.error('Failed to fetch purchases:', err)
    } finally {
      setLoading(false)
    }
  }, [user?.currentShopId, currentPage])

  useEffect(() => {
    if (user?.currentShopId) {
      fetchPurchases()
      fetchProducts()
      fetchSuppliers()
    }
  }, [user?.currentShopId, fetchPurchases])

  async function fetchProducts() {
    try {
      const response = await fetch('/api/products?limit=1000')
      if (response.ok) {
        const data = await response.json()
        setProducts(data.products || [])
      }
    } catch (err) {
      console.error('Failed to fetch products:', err)
    }
  }

  async function fetchSuppliers() {
    try {
      const response = await fetch('/api/suppliers?limit=1000')
      if (response.ok) {
        const data = await response.json()
        setSuppliers(data.suppliers || [])
      }
    } catch (err) {
      console.error('Failed to fetch suppliers:', err)
    }
  }

  function openCreateForm() {
    setFormData({
      supplierId: '',
      date: new Date().toISOString().split('T')[0],
      reference: '',
      notes: '',
      lines: [{ productId: '', quantity: '', unitCost: '' }],
    })
    setError('')
    setShowForm(true)
  }

  function addLine() {
    setFormData({
      ...formData,
      lines: [...formData.lines, { productId: '', quantity: '', unitCost: '' }],
    })
  }

  function removeLine(index: number) {
    setFormData({
      ...formData,
      lines: formData.lines.filter((_, i) => i !== index),
    })
  }

  function updateLine(index: number, field: keyof PurchaseLine, value: string) {
    const newLines = [...formData.lines]
    newLines[index] = { ...newLines[index], [field]: value }
    setFormData({ ...formData, lines: newLines })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    // Validate at least one line with product and quantity
    const validLines = formData.lines.filter(
      (line) => line.productId && line.quantity && parseFloat(line.quantity) > 0
    )

    if (validLines.length === 0) {
      setError('Please add at least one product with quantity')
      return
    }

    setSubmitting(true)

    try {
      if (!user?.currentShopId) {
        setError('No shop selected')
        setSubmitting(false)
        return
      }

      const id = cuid()
      const purchase = {
        id,
        shopId: user.currentShopId,
        supplierId: formData.supplierId || undefined,
        date: formData.date ? new Date(formData.date).getTime() : undefined,
        reference: formData.reference || undefined,
        notes: formData.notes || undefined,
        lines: validLines.map((line) => ({
          productId: line.productId,
          quantity: parseFloat(line.quantity),
          unitCost: line.unitCost ? parseFloat(line.unitCost) : undefined,
        })),
      }

      // Save locally (offline-first)
      await savePurchaseLocally(purchase)

      // Attempt sync if online
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        await syncPendingPurchasesBatch(user.currentShopId)
      }

      // Reset form and refresh list
      setShowForm(false)
      await fetchPurchases()
      router.refresh()
    } catch (err) {
      setError('An error occurred. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!user?.currentShopId) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Purchases</h1>
        <p className="text-gray-600">Please select a shop first</p>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Purchases</h1>
        <button
          onClick={openCreateForm}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          New Purchase
        </button>
      </div>

      {/* Purchase Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">New Purchase</h2>

            {error && (
              <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {/* Header Fields */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium mb-1">Supplier</label>
                  <select
                    value={formData.supplierId}
                    onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">None</option>
                    {suppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Reference</label>
                  <input
                    type="text"
                    value={formData.reference}
                    onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Invoice/Bill number"
                  />
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={2}
                  placeholder="Additional notes"
                />
              </div>

              {/* Lines Table */}
              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium">Items</label>
                  <button
                    type="button"
                    onClick={addLine}
                    className="px-3 py-1 text-sm bg-gray-200 rounded hover:bg-gray-300"
                  >
                    + Add Item
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border p-2 text-left">Product</th>
                        <th className="border p-2 text-right">Quantity</th>
                        <th className="border p-2 text-right">Unit Cost</th>
                        <th className="border p-2 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {formData.lines.map((line, index) => (
                        <tr key={index}>
                          <td className="border p-2">
                            <select
                              required={index === 0}
                              value={line.productId}
                              onChange={(e) =>
                                updateLine(index, 'productId', e.target.value)
                              }
                              className="w-full px-2 py-1 border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                            >
                              <option value="">Select product</option>
                              {products.map((product) => (
                                <option key={product.id} value={product.id}>
                                  {product.name} ({product.unit})
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="border p-2">
                            <input
                              type="number"
                              step="0.001"
                              required={index === 0}
                              value={line.quantity}
                              onChange={(e) =>
                                updateLine(index, 'quantity', e.target.value)
                              }
                              className="w-full px-2 py-1 border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                              placeholder="0"
                            />
                          </td>
                          <td className="border p-2">
                            <input
                              type="number"
                              step="0.01"
                              value={line.unitCost}
                              onChange={(e) =>
                                updateLine(index, 'unitCost', e.target.value)
                              }
                              className="w-full px-2 py-1 border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                              placeholder="Optional"
                            />
                          </td>
                          <td className="border p-2 text-center">
                            {formData.lines.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeLine(index)}
                                className="text-red-600 hover:underline"
                              >
                                Remove
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false)
                    setError('')
                  }}
                  className="px-4 py-2 border rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {submitting ? 'Creating...' : 'Create Purchase'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Purchases List */}
      {loading ? (
        <div className="text-center py-8">Loading...</div>
      ) : purchases.length === 0 ? (
        <div className="text-center py-8 text-gray-600">
          No purchases yet. Create your first purchase!
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border p-2 text-left">Date</th>
                  <th className="border p-2 text-left">Supplier</th>
                  <th className="border p-2 text-left">Reference</th>
                  <th className="border p-2 text-center">Items</th>
                  <th className="border p-2 text-left">Created By</th>
                  <th className="border p-2 text-left">Notes</th>
                </tr>
              </thead>
              <tbody>
                {purchases.map((purchase) => (
                  <tr
                    key={purchase.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => {
                      // Could navigate to purchase detail page in future
                      console.log('Purchase:', purchase.id)
                    }}
                  >
                    <td className="border p-2">
                      {new Date(purchase.date).toLocaleDateString()}
                    </td>
                    <td className="border p-2">{purchase.supplier?.name || '-'}</td>
                    <td className="border p-2">{purchase.reference || '-'}</td>
                    <td className="border p-2 text-center">{purchase._count.lines}</td>
                    <td className="border p-2">{purchase.createdBy?.name || '-'}</td>
                    <td className="border p-2">{purchase.notes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="mt-4 flex justify-between items-center">
              <div className="text-sm text-gray-600">
                Showing {purchases.length} of {pagination.total} purchases
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