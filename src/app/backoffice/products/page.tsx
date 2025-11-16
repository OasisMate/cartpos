'use client'

import { useState, useEffect, useCallback } from 'react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import { Table, THead, TR, TH, TD, EmptyRow, SkeletonRow } from '@/components/ui/DataTable'
import { useToast } from '@/components/ui/ToastProvider'
import { useAuth } from '@/contexts/AuthContext'

interface Product {
  id: string
  name: string
  sku: string | null
  barcode: string | null
  unit: string
  price: string
  costPrice: string | null
  category: string | null
  trackStock: boolean
  reorderLevel: number | null
  createdAt: string
  updatedAt: string
}

interface ProductsResponse {
  products: Product[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

const COMMON_UNITS = ['pcs', 'kg', 'g', 'L', 'mL', 'pack', 'box', 'dozen', 'piece']

export default function ProductsPage() {
  const { user } = useAuth()
  const { show } = useToast()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 1,
  })
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    barcode: '',
    unit: 'pcs',
    price: '',
    costPrice: '',
    category: '',
    trackStock: true,
    reorderLevel: '',
  })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchProducts = useCallback(async () => {
    if (!user?.currentShopId) return

    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '50',
      })
      if (searchTerm) {
        params.append('search', searchTerm)
      }

      const response = await fetch(`/api/products?${params}`)
      if (response.ok) {
        const data: ProductsResponse = await response.json()
        setProducts(data.products || [])
        setPagination(data.pagination)
      }
    } catch (err) {
      console.error('Failed to fetch products:', err)
    } finally {
      setLoading(false)
    }
  }, [user?.currentShopId, currentPage, searchTerm])

  useEffect(() => {
    if (user?.currentShopId) {
      fetchProducts()
    }
  }, [user?.currentShopId, fetchProducts])

  function openCreateForm() {
    setEditingProduct(null)
    setFormData({
      name: '',
      sku: '',
      barcode: '',
      unit: 'pcs',
      price: '',
      costPrice: '',
      category: '',
      trackStock: true,
      reorderLevel: '',
    })
    setError('')
    setShowForm(true)
  }

  function openEditForm(product: Product) {
    setEditingProduct(product)
    setFormData({
      name: product.name,
      sku: product.sku || '',
      barcode: product.barcode || '',
      unit: product.unit,
      price: product.price,
      costPrice: product.costPrice || '',
      category: product.category || '',
      trackStock: product.trackStock,
      reorderLevel: product.reorderLevel?.toString() || '',
    })
    setError('')
    setShowForm(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      const url = editingProduct
        ? `/api/products/${editingProduct.id}`
        : '/api/products'
      const method = editingProduct ? 'PUT' : 'POST'

      const payload: any = {
        name: formData.name,
        unit: formData.unit,
        price: formData.price,
        trackStock: formData.trackStock,
      }

      if (formData.sku) payload.sku = formData.sku
      if (formData.barcode) payload.barcode = formData.barcode
      if (formData.costPrice) payload.costPrice = formData.costPrice
      if (formData.category) payload.category = formData.category
      if (formData.reorderLevel) payload.reorderLevel = formData.reorderLevel

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (!response.ok) {
        const msg = data.error || `Failed to ${editingProduct ? 'update' : 'create'} product`
        setError(msg)
        show({ title: 'Error', message: msg, variant: 'destructive' })
        setSubmitting(false)
        return
      }

      // Reset form and refresh list
      setShowForm(false)
      setEditingProduct(null)
      await fetchProducts()
      show({ message: editingProduct ? 'Product updated' : 'Product created', variant: 'success' })
    } catch (err) {
      setError('An error occurred. Please try again.')
      show({ title: 'Error', message: 'Unexpected error', variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setCurrentPage(1)
    fetchProducts()
  }

  if (!user?.currentShopId) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Products</h1>
        {user?.role === 'PLATFORM_ADMIN' ? (
          <div className="space-y-3">
            <p className="text-[hsl(var(--muted-foreground))]">No shop selected. Go to Admin to manage or create a shop.</p>
            <div className="flex gap-2">
              <a href="/admin/shops" className="btn btn-primary h-9 px-4">Open Shops</a>
              <a href="/admin" className="btn btn-outline h-9 px-4">Admin</a>
            </div>
          </div>
        ) : (
          <p className="text-[hsl(var(--muted-foreground))]">Please select a shop first</p>
        )}
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Products</h1>
        <Button onClick={openCreateForm}>Add Product</Button>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="mb-4">
        <div className="flex gap-2">
          <Input
            type="text"
            placeholder="Search products (name, SKU, barcode)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" variant="outline">Search</Button>
        </div>
      </form>

      {/* Product Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">
              {editingProduct ? 'Edit Product' : 'Add Product'}
            </h2>

            {error && (
              <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <Input
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">SKU</label>
                  <Input
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Barcode</label>
                  <Input
                    value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Unit <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <Select
                      value={formData.unit}
                      onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                      className="flex-1"
                    >
                      {COMMON_UNITS.map((unit) => (
                        <option key={unit} value={unit}>
                          {unit}
                        </option>
                      ))}
                    </Select>
                    <Input
                      placeholder="Custom"
                      value={!COMMON_UNITS.includes(formData.unit) ? formData.unit : ''}
                      onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                      className="flex-1"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Price <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    required
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Cost Price</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.costPrice}
                    onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Category</label>
                  <Input
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Reorder Level</label>
                  <Input
                    type="number"
                    value={formData.reorderLevel}
                    onChange={(e) => setFormData({ ...formData, reorderLevel: e.target.value })}
                  />
                </div>
              </div>

              <div className="mt-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.trackStock}
                    onChange={(e) => setFormData({ ...formData, trackStock: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-medium">Track Stock</span>
                </label>
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowForm(false)
                    setEditingProduct(null)
                    setError('')
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Saving...' : editingProduct ? 'Update' : 'Create'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Products List */}
      {loading ? (
        <div className="text-center py-8">Loading...</div>
      ) : products.length === 0 ? (
        <div className="text-center py-8 text-[hsl(var(--muted-foreground))]">
          {searchTerm ? 'No products found' : 'No products yet. Create your first product!'}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <TR>
                  <TH>Name</TH>
                  <TH>SKU</TH>
                  <TH>Barcode</TH>
                  <TH>Unit</TH>
                  <TH className="text-right">Price</TH>
                  <TH className="text-right">Cost Price</TH>
                  <TH>Category</TH>
                  <TH className="text-center">Track Stock</TH>
                  <TH className="text-right">Reorder Level</TH>
                  <TH className="text-center">Actions</TH>
                </TR>
              </THead>
              <tbody>
                {products.length === 0 ? (
                  <EmptyRow colSpan={10} message="No products" />
                ) : (
                  products.map((product) => (
                    <TR key={product.id}>
                      <TD>{product.name}</TD>
                      <TD>{product.sku || '-'}</TD>
                      <TD>{product.barcode || '-'}</TD>
                      <TD>{product.unit}</TD>
                      <TD className="text-right">{parseFloat(product.price).toFixed(2)}</TD>
                      <TD className="text-right">
                        {product.costPrice ? parseFloat(product.costPrice).toFixed(2) : '-'}
                      </TD>
                      <TD>{product.category || '-'}</TD>
                      <TD className="text-center">
                        {product.trackStock ? (
                          <span className="text-green-600">Yes</span>
                        ) : (
                          <span className="text-[hsl(var(--muted-foreground))]">No</span>
                        )}
                      </TD>
                      <TD className="text-right">{product.reorderLevel || '-'}</TD>
                      <TD className="text-center">
                        <Button variant="outline" onClick={() => openEditForm(product)} size="sm">
                          Edit
                        </Button>
                      </TD>
                    </TR>
                  ))
                )}
              </tbody>
            </Table>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="mt-4 flex justify-between items-center">
              <div className="text-sm text-gray-600">
                Showing {products.length} of {pagination.total} products
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