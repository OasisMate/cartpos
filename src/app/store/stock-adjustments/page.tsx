'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Table, THead, TR, TH, TD, EmptyRow } from '@/components/ui/DataTable'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'

interface StockAdjustment {
  id: string
  productId: string
  changeQty: string
  type: 'ADJUSTMENT' | 'DAMAGE' | 'EXPIRY' | 'RETURN' | 'SELF_USE'
  createdAt: string
  product: {
    id: string
    name: string
    unit: string
    barcode: string | null
    sku: string | null
  }
}

interface StockAdjustmentsResponse {
  adjustments: StockAdjustment[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

interface Product {
  id: string
  name: string
}

const ADJUSTMENT_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'ADJUSTMENT', label: 'General Adjustment' },
  { value: 'DAMAGE', label: 'Damage' },
  { value: 'EXPIRY', label: 'Expiry' },
  { value: 'RETURN', label: 'Return' },
  { value: 'SELF_USE', label: 'Self Use' },
]

export default function StockAdjustmentsPage() {
  const { user } = useAuth()
  const [adjustments, setAdjustments] = useState<StockAdjustment[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 1,
  })
  const [filters, setFilters] = useState({
    productId: '',
    type: '',
    startDate: '',
    endDate: '',
  })

  // Fetch products for filter dropdown
  const fetchProducts = useCallback(async () => {
    if (!user?.currentShopId) return
    try {
      const response = await fetch('/api/products?limit=1000')
      if (response.ok) {
        const data = await response.json()
        setProducts(data.products || [])
      }
    } catch (err) {
      console.error('Failed to fetch products:', err)
    }
  }, [user?.currentShopId])

  const fetchAdjustments = useCallback(async () => {
    if (!user?.currentShopId) return
    try {
      setLoading(true)
      setError('')
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '50',
      })
      if (filters.productId) {
        params.set('productId', filters.productId)
      }
      if (filters.type) {
        params.set('type', filters.type)
      }
      if (filters.startDate) {
        params.set('startDate', filters.startDate)
      }
      if (filters.endDate) {
        params.set('endDate', filters.endDate)
      }

      const response = await fetch(`/api/stock-adjustments?${params}`)
      const data: StockAdjustmentsResponse = await response.json()
      
      if (!response.ok) {
        throw new Error((data as any)?.error || 'Failed to load adjustments')
      }
      
      setAdjustments(data.adjustments || [])
      setPagination(data.pagination)
    } catch (err: any) {
      setError(err.message || 'Failed to load stock adjustments')
    } finally {
      setLoading(false)
    }
  }, [user?.currentShopId, currentPage, filters])

  useEffect(() => {
    if (user?.currentShopId) {
      fetchProducts()
      fetchAdjustments()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.currentShopId])

  useEffect(() => {
    fetchAdjustments()
  }, [fetchAdjustments])

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
    setCurrentPage(1) // Reset to first page when filter changes
  }

  const clearFilters = () => {
    setFilters({
      productId: '',
      type: '',
      startDate: '',
      endDate: '',
    })
    setCurrentPage(1)
  }

  const getTypeLabel = (type: string) => {
    const typeMap: Record<string, string> = {
      ADJUSTMENT: 'General Adjustment',
      DAMAGE: 'Damage',
      EXPIRY: 'Expiry',
      RETURN: 'Return',
      SELF_USE: 'Self Use',
    }
    return typeMap[type] || type
  }

  const getTypeColor = (type: string) => {
    const colorMap: Record<string, string> = {
      ADJUSTMENT: 'bg-blue-100 text-blue-800',
      DAMAGE: 'bg-red-100 text-red-800',
      EXPIRY: 'bg-orange-100 text-orange-800',
      RETURN: 'bg-green-100 text-green-800',
      SELF_USE: 'bg-purple-100 text-purple-800',
    }
    return colorMap[type] || 'bg-gray-100 text-gray-800'
  }

  if (!user?.currentShopId) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Stock Adjustments</h1>
        <p className="text-gray-600">Please select a shop first</p>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Stock Adjustments</h1>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg border border-gray-200 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Product
            </label>
            <Select
              value={filters.productId}
              onChange={(e) => handleFilterChange('productId', e.target.value)}
            >
              <option value="">All Products</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Type
            </label>
            <Select
              value={filters.type}
              onChange={(e) => handleFilterChange('type', e.target.value)}
            >
              {ADJUSTMENT_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Date
            </label>
            <Input
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              End Date
            </label>
            <Input
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
            />
          </div>
        </div>

        <div className="mt-4">
          <Button variant="outline" onClick={clearFilters} size="sm">
            Clear Filters
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">{error}</div>
      )}

      {loading ? (
        <div className="text-center py-8">Loading...</div>
      ) : adjustments.length === 0 ? (
        <div className="text-center py-8 text-gray-600">
          No stock adjustments found.
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <TR>
                  <TH>Date & Time</TH>
                  <TH>Product</TH>
                  <TH>Type</TH>
                  <TH className="text-right">Quantity Change</TH>
                </TR>
              </THead>
              <tbody>
                {adjustments.map((adjustment) => {
                  const changeQty = parseFloat(adjustment.changeQty)
                  const isPositive = changeQty > 0
                  
                  return (
                    <TR key={adjustment.id}>
                      <TD>
                        {new Date(adjustment.createdAt).toLocaleString()}
                      </TD>
                      <TD>
                        <div>
                          <div className="font-medium">{adjustment.product.name}</div>
                          {adjustment.product.sku && (
                            <div className="text-xs text-gray-500">
                              SKU: {adjustment.product.sku}
                            </div>
                          )}
                        </div>
                      </TD>
                      <TD>
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${getTypeColor(
                            adjustment.type
                          )}`}
                        >
                          {getTypeLabel(adjustment.type)}
                        </span>
                      </TD>
                      <TD className="text-right">
                        <span
                          className={
                            isPositive
                              ? 'text-green-600 font-semibold'
                              : 'text-red-600 font-semibold'
                          }
                        >
                          {isPositive ? '+' : ''}
                          {changeQty.toFixed(2)} {adjustment.product.unit}
                        </span>
                      </TD>
                    </TR>
                  )
                })}
              </tbody>
            </Table>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="mt-4 flex justify-between items-center">
              <div className="text-sm text-gray-600">
                Showing {adjustments.length} of {pagination.total} adjustments
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
                  onClick={() =>
                    setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))
                  }
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

