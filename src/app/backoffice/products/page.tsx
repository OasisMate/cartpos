'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import { Table, THead, TR, TH, TD, EmptyRow, SkeletonRow } from '@/components/ui/DataTable'
import EmptyState from '@/components/ui/EmptyState'
import Modal from '@/components/ui/Modal'
import { useToast } from '@/components/ui/ToastProvider'
import { useAuth } from '@/contexts/AuthContext'
import { formatNumber, formatCurrency } from '@/lib/utils/money'
import { Pencil, Trash2, Package, Loader2, Plus, ArrowUpDown, ArrowUp, ArrowDown, Archive, ArchiveRestore } from 'lucide-react'
import IconButton from '@/components/ui/IconButton'
import ImportProductsModal from '@/components/products/ImportProductsModal'

interface Product {
  id: string
  name: string
  sku: string | null
  barcode: string | null
  unit: string
  price: string
  tradePrice: string | null
  costPrice: string | null
  category: string | null
  trackStock: boolean
  reorderLevel: number | null
  cartonSize: number | null
  cartonBarcode: string | null
  stock: number | null
  archivedAt: string | null
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

const COMMON_UNITS = ['pcs', 'kg', 'g', 'L', 'mL', 'pack', 'box', 'dozen']

// Columns the server can sort by (real DB columns). Others fall back to page-local client sort.
const SERVER_SORT_COLUMNS = ['name', 'price', 'costPrice', 'sku']

export default function ProductsPage() {
  const { user } = useAuth()
  const { show } = useToast()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  // Monotonic id so a slow/older /api/products response can't overwrite a newer one.
  const searchReqIdRef = useRef(0)
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
    tradePrice: '',
    cartonPrice: '',
    costPrice: '',
    trackStock: false,
    reorderLevel: '',
    cartonSize: '',
    cartonBarcode: '',
    initialStock: '',
  })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false)
  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null)
  const [adjustmentData, setAdjustmentData] = useState({
    type: 'ADJUSTMENT' as 'ADJUSTMENT' | 'DAMAGE' | 'EXPIRY' | 'RETURN' | 'SELF_USE',
    quantity: '',
    notes: '',
  })
  const [adjusting, setAdjusting] = useState(false)
  const [adjustmentError, setAdjustmentError] = useState('')
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [productToDelete, setProductToDelete] = useState<Product | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [archivingId, setArchivingId] = useState<string | null>(null)
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  // Sorting function
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      // Toggle direction if same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      // New column, default to ascending
      setSortColumn(column)
      setSortDirection('asc')
    }
    // server-sortable columns sort the whole catalog - restart from page 1.
    if (SERVER_SORT_COLUMNS.includes(column)) setCurrentPage(1)
  }

  // Sort products
  const sortedProducts = [...products].sort((a, b) => {
    if (!sortColumn) return 0

    let aValue: any
    let bValue: any

    switch (sortColumn) {
      case 'name':
        aValue = a.name.toLowerCase()
        bValue = b.name.toLowerCase()
        break
      case 'sku':
        aValue = (a.sku || '').toLowerCase()
        bValue = (b.sku || '').toLowerCase()
        break
      case 'barcode':
        aValue = (a.barcode || '').toLowerCase()
        bValue = (b.barcode || '').toLowerCase()
        break
      case 'unit':
        aValue = a.unit.toLowerCase()
        bValue = b.unit.toLowerCase()
        break
      case 'price':
        aValue = parseFloat(a.price)
        bValue = parseFloat(b.price)
        break
      case 'costPrice':
        aValue = a.costPrice ? parseFloat(a.costPrice) : 0
        bValue = b.costPrice ? parseFloat(b.costPrice) : 0
        break
      case 'stock':
        aValue = a.stock ?? 0
        bValue = b.stock ?? 0
        break
      case 'trackStock':
        aValue = a.trackStock ? 1 : 0
        bValue = b.trackStock ? 1 : 0
        break
      case 'reorderLevel':
        aValue = a.reorderLevel ?? 0
        bValue = b.reorderLevel ?? 0
        break
      default:
        return 0
    }

    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1
    return 0
  })

  // Helper function to render sort icon
  const renderSortIcon = (column: string) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="w-3 h-3 ml-1 text-gray-400" />
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="w-3 h-3 ml-1 text-blue-600" />
      : <ArrowDown className="w-3 h-3 ml-1 text-blue-600" />
  }

  // Refs for form inputs to support barcode scanning and fast entry
  const barcodeInputRef = useRef<HTMLInputElement>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const cartonBarcodeInputRef = useRef<HTMLInputElement>(null)
  const unitSelectRef = useRef<HTMLSelectElement>(null)
  const priceInputRef = useRef<HTMLInputElement>(null)

  const fetchProducts = useCallback(async () => {
    if (!user?.currentShopId) return

    const reqId = ++searchReqIdRef.current
    const isStale = () => reqId !== searchReqIdRef.current

    try {
      setLoading(true)

      // Try API first if online
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        try {
          const params = new URLSearchParams({
            page: currentPage.toString(),
            limit: pageSize.toString(),
          })
          if (debouncedSearch) {
            params.append('search', debouncedSearch)
          }
          if (showArchived) {
            params.append('includeArchived', 'true')
          }
          // Server-side sort for DB columns (sorts the whole catalog, not just this page).
          if (sortColumn && SERVER_SORT_COLUMNS.includes(sortColumn)) {
            params.append('sortBy', sortColumn)
            params.append('sortDir', sortDirection)
          }

          const response = await fetch(`/api/products?${params}`)
          if (response.ok) {
            const data: ProductsResponse = await response.json()
            if (isStale()) return // a newer search/page started; drop this result
            setProducts(data.products || [])
            setPagination(data.pagination)
            setLoading(false)
            return
          }
        } catch (apiError) {
          console.warn('API failed, falling back to cache:', apiError)
        }
      }
      if (isStale()) return
      
      // Offline or API failed: use cached products (basic info only)
      const { getProductsWithCache } = await import('@/lib/offline/products')
      const cached = await getProductsWithCache(user.currentShopId, false)
      let rows = cached.map((p) => ({
        id: p.id,
        name: p.name,
        sku: null,
        barcode: p.barcode,
        unit: p.unit,
        price: p.price.toString(),
        tradePrice: p.tradePrice?.toString() || null,
        costPrice: null,
        category: null,
        trackStock: p.trackStock,
        reorderLevel: null,
        stock: null, // Stock requires server calculation
        cartonSize: p.cartonSize ?? null,
        cartonBarcode: p.cartonBarcode ?? null,
        cartonPrice: p.cartonPrice?.toString() || null,
        archivedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }))
      
      // Apply search filter
      if (debouncedSearch) {
        const term = debouncedSearch.toLowerCase()
        rows = rows.filter((p) =>
          p.name.toLowerCase().includes(term) ||
          (p.barcode && p.barcode.toLowerCase().includes(term))
        )
      }

      if (isStale()) return
      setProducts(rows)
      setPagination({
        page: 1,
        limit: 50,
        total: rows.length,
        totalPages: 1,
      })
    } catch (err) {
      console.error('Failed to fetch products:', err)
    } finally {
      if (!isStale()) setLoading(false)
    }
  }, [user?.currentShopId, currentPage, pageSize, debouncedSearch, sortColumn, sortDirection, showArchived])

  // Debounce the search box: wait 300ms after typing stops, then search from page 1.
  // Prevents a request per keystroke (was 7 calls for "shampoo").
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim())
      setCurrentPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [searchTerm])

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
      tradePrice: '',
      cartonPrice: '',
      costPrice: '',
      trackStock: false,
      reorderLevel: '',
      cartonSize: '',
      cartonBarcode: '',
      initialStock: '',
    })
    setError('')
    setShowForm(true)
    // Auto-focus barcode input for scanning when form opens
    setTimeout(() => {
      if (barcodeInputRef.current) {
        barcodeInputRef.current.focus()
      }
    }, 100)
  }

  function openEditForm(product: Product) {
    setEditingProduct(product)
    setFormData({
      name: product.name,
      sku: product.sku || '',
      barcode: product.barcode || '',
      unit: product.unit,
      price: product.price,
      tradePrice: (product as any).tradePrice || '',
      cartonPrice: (product as any).cartonPrice || '',
      costPrice: product.costPrice || '',
      trackStock: product.trackStock,
      reorderLevel: product.reorderLevel?.toString() || '',
      cartonSize: product.cartonSize?.toString() || '',
      cartonBarcode: product.cartonBarcode || '',
      initialStock: '', // Not editable for existing products
    })
    setError('')
    setShowForm(true)
  }

  async function handleSubmit(e?: React.FormEvent, keepOpen = false) {
    e?.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      // Validate price
      const price = parseFloat(formData.price)
      if (isNaN(price) || price <= 0) {
        setError('Price must be a valid positive number')
        setSubmitting(false)
        return
      }
      if (price >= 100000000) {
        setError('Price must be less than 100,000,000')
        setSubmitting(false)
        return
      }
      
      // Validate cost price if provided
      if (formData.costPrice) {
        const costPrice = parseFloat(formData.costPrice)
        if (isNaN(costPrice) || costPrice < 0) {
          setError('Cost price must be a valid non-negative number')
          setSubmitting(false)
          return
        }
        if (costPrice >= 100000000) {
          setError('Cost price must be less than 100,000,000')
          setSubmitting(false)
          return
        }
      }
      
      // Validate carton price if provided
      if (formData.cartonPrice) {
        const cartonPrice = parseFloat(formData.cartonPrice)
        if (isNaN(cartonPrice) || cartonPrice <= 0) {
          setError('Carton price must be a valid positive number')
          setSubmitting(false)
          return
        }
        if (cartonPrice >= 100000000) {
          setError('Carton price must be less than 100,000,000')
          setSubmitting(false)
          return
        }
      }

      // Validate trade (wholesale) price if provided
      if (formData.tradePrice) {
        const tradePrice = parseFloat(formData.tradePrice)
        if (isNaN(tradePrice) || tradePrice <= 0) {
          setError('Trade price must be a valid positive number')
          setSubmitting(false)
          return
        }
        if (tradePrice >= 100000000) {
          setError('Trade price must be less than 100,000,000')
          setSubmitting(false)
          return
        }
      }

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
      if (formData.reorderLevel) payload.reorderLevel = formData.reorderLevel
      if (formData.cartonSize) payload.cartonSize = formData.cartonSize
      if (formData.cartonBarcode) payload.cartonBarcode = formData.cartonBarcode
      if (formData.cartonPrice) payload.cartonPrice = formData.cartonPrice
      if (formData.tradePrice) payload.tradePrice = formData.tradePrice
      
      // Add initial stock only when creating new product
      if (!editingProduct && formData.initialStock && formData.trackStock) {
        const initialStock = parseFloat(formData.initialStock)
        if (!isNaN(initialStock) && initialStock > 0) {
          payload.initialStock = initialStock
        }
      }

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

      // Optimistic update: add/update product in local state immediately
      const apiProduct = data.product
      const optimisticProduct: Product = {
        id: apiProduct.id,
        name: apiProduct.name,
        sku: apiProduct.sku || null,
        barcode: apiProduct.barcode || null,
        unit: apiProduct.unit,
        price: apiProduct.price.toString(),
        tradePrice: apiProduct.tradePrice ? apiProduct.tradePrice.toString() : null,
        costPrice: apiProduct.costPrice ? apiProduct.costPrice.toString() : null,
        category: null,
        trackStock: apiProduct.trackStock,
        reorderLevel: apiProduct.reorderLevel || null,
        cartonSize: apiProduct.cartonSize || null,
        cartonBarcode: apiProduct.cartonBarcode || null,
        archivedAt: apiProduct.archivedAt || null,
        stock: null, // Will be loaded on refresh
        createdAt: apiProduct.createdAt || new Date().toISOString(),
        updatedAt: apiProduct.updatedAt || new Date().toISOString(),
      }

      if (editingProduct) {
        // Update existing product in list
        setProducts(prev => prev.map(p => p.id === optimisticProduct.id ? optimisticProduct : p))
      } else {
        // Add new product to list (optimistic update)
        setProducts(prev => {
          const newList = [optimisticProduct, ...prev]
          // Re-sort to maintain alphabetical order
          return newList.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
        })
        // Update pagination
        setPagination(prev => ({
          ...prev,
          total: prev.total + 1,
        }))
      }

      const wasEditing = !!editingProduct

      if (keepOpen && !wasEditing) {
        // Fast bulk entry: keep modal open, clear fields but keep unit + track-stock
        // preference, and refocus the name field for the next item.
        setFormData({
          name: '', sku: '', barcode: '', unit: formData.unit, price: '',
          tradePrice: '', cartonPrice: '', costPrice: '', trackStock: formData.trackStock,
          reorderLevel: '', cartonSize: '', cartonBarcode: '', initialStock: '',
        })
        setError('')
        setTimeout(() => nameInputRef.current?.focus(), 0)
      } else {
        setShowForm(false)
        setEditingProduct(null)
      }

      // Refresh in background to ensure data consistency (non-blocking)
      fetchProducts().catch(err => console.error('Background refresh failed:', err))

      show({ message: wasEditing ? 'Product updated' : 'Product created', variant: 'success' })
    } catch (err) {
      setError('An error occurred. Please try again.')
      show({ title: 'Error', message: 'Unexpected error', variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    // Apply the search immediately (bypass the 300ms debounce); the fetch effect
    // re-runs off debouncedSearch + currentPage.
    setCurrentPage(1)
    setDebouncedSearch(searchTerm.trim())
  }

  const openAdjustmentModal = (product: Product) => {
    if (!product.trackStock) {
      show({ title: 'Error', message: 'This product does not track stock', variant: 'destructive' })
      return
    }
    setAdjustingProduct(product)
    setAdjustmentData({
      type: 'ADJUSTMENT',
      quantity: '',
      notes: '',
    })
    setShowAdjustmentModal(true)
  }

  const closeAdjustmentModal = () => {
    setShowAdjustmentModal(false)
    setAdjustingProduct(null)
    setAdjustmentData({
      type: 'ADJUSTMENT',
      quantity: '',
      notes: '',
    })
    setAdjustmentError('')
  }

  const handleAdjustmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!adjustingProduct) return

    const quantity = parseFloat(adjustmentData.quantity)
    if (isNaN(quantity) || quantity === 0) {
      setAdjustmentError('Quantity must be a non-zero number')
      return
    }

    setAdjusting(true)
    setAdjustmentError('')

    try {
      const response = await fetch('/api/stock-adjustments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: adjustingProduct.id,
          type: adjustmentData.type,
          quantity: quantity,
          notes: adjustmentData.notes || undefined,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to adjust stock')
      }

      const result = await response.json()
      show({
        title: 'Success',
        message: `Stock adjusted successfully. New stock: ${formatNumber(result.newStock)} ${adjustingProduct.unit}`,
        variant: 'success',
      })

      closeAdjustmentModal()
      fetchProducts() // Refresh products list
    } catch (err: any) {
      setAdjustmentError(err.message || 'Failed to adjust stock')
    } finally {
      setAdjusting(false)
    }
  }

  const handleDeleteClick = (product: Product) => {
    setProductToDelete(product)
    setShowDeleteConfirm(true)
  }

  const handleArchiveToggle = async (product: Product) => {
    const archive = !product.archivedAt
    setArchivingId(product.id)
    try {
      const response = await fetch(`/api/products/${product.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: archive }),
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update product')
      }
      show({ message: archive ? 'Product archived' : 'Product restored', variant: 'success' })
      await fetchProducts()
    } catch (err: any) {
      show({ title: 'Error', message: err.message || 'Failed to update product', variant: 'destructive' })
    } finally {
      setArchivingId(null)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!productToDelete) return

    setDeletingProductId(productToDelete.id)
    try {
      const response = await fetch(`/api/products/${productToDelete.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete product')
      }

      show({
        title: 'Success',
        message: 'Product deleted successfully',
        variant: 'success',
      })

      setShowDeleteConfirm(false)
      setProductToDelete(null)
      await fetchProducts()
    } catch (err: any) {
      show({
        title: 'Error',
        message: err.message || 'Failed to delete product',
        variant: 'destructive',
      })
    } finally {
      setDeletingProductId(null)
    }
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
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowImport(true)} className="flex items-center gap-2">
            <span>Import CSV</span>
          </Button>
          <Button onClick={openCreateForm} className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            <span>Add Product</span>
          </Button>
        </div>
      </div>

      <ImportProductsModal
        open={showImport}
        onClose={() => setShowImport(false)}
        onDone={() => fetchProducts()}
      />

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
        <label className="mt-2 inline-flex items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => { setShowArchived(e.target.checked); setCurrentPage(1) }}
            className="w-4 h-4"
          />
          <span>Show archived products</span>
        </label>
      </form>

      {/* Product Form Modal */}
      <Modal
        open={showForm}
        onClose={() => {
          setShowForm(false)
          setEditingProduct(null)
          setError('')
        }}
        title={editingProduct ? 'Edit Product' : 'Add Product'}
        size="lg"
      >
            {error && (
              <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-2 gap-4">
                {/* First row: Barcode + Name (fast tab flow) */}
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Barcode
                  </label>
                  <Input
                    ref={barcodeInputRef}
                    value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    placeholder="Scan barcode or type manually"
                    onKeyDown={(e) => {
                      // When Enter is pressed (typical barcode scanner behavior), jump to Name
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        if (nameInputRef.current) {
                          nameInputRef.current.focus()
                          nameInputRef.current.select()
                        }
                      }
                    }}
                    autoFocus={!editingProduct}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <Input
                    ref={nameInputRef}
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    onKeyDown={(e) => {
                      // Enter from name goes straight to price
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        if (priceInputRef.current) {
                          priceInputRef.current.focus()
                          priceInputRef.current.select()
                        }
                      }
                    }}
                  />
                </div>

                {/* Second row: Price + Unit */}
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Price <span className="text-red-500">*</span>
                  </label>
                  <Input
                    ref={priceInputRef}
                    type="number"
                    step="0.01"
                    required
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Unit <span className="text-red-500">*</span>
                  </label>
                  <Select
                    ref={unitSelectRef}
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full"
                  >
                    {COMMON_UNITS.map((unit) => (
                      <option key={unit} value={unit}>
                        {unit}
                      </option>
                    ))}
                  </Select>
                </div>

                {/* Remaining less-frequent fields */}
                <div>
                  <label className="block text-sm font-medium mb-1">
                    SKU <span className="text-xs text-gray-500 font-normal">(optional)</span>
                  </label>
                  <Input
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    placeholder="Leave empty to auto-generate"
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
                  <label className="block text-sm font-medium mb-1">
                    Trade Price
                    <span className="text-xs text-gray-500 ml-2">(optional wholesale rate)</span>
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="For contractors / bulk"
                    value={formData.tradePrice}
                    onChange={(e) => setFormData({ ...formData, tradePrice: e.target.value })}
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

                {!editingProduct && (
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Initial Stock
                      <span className="text-xs text-gray-500 ml-2">(only if tracking stock)</span>
                    </label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.initialStock}
                      onChange={(e) => setFormData({ ...formData, initialStock: e.target.value })}
                      placeholder="e.g. 24"
                    />
                  </div>
                )}
              </div>

              {/* Carton / Packing Section */}
              <div className="mt-6 border-t pt-4">
                <h3 className="text-sm font-semibold mb-3 text-gray-700">Carton / Packing Details</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Items per Carton</label>
                    <Input
                      type="number"
                      placeholder="e.g. 12"
                      value={formData.cartonSize}
                      onChange={(e) => setFormData({ ...formData, cartonSize: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Carton Price</label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Carton price"
                      value={formData.cartonPrice}
                      onChange={(e) => setFormData({ ...formData, cartonPrice: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Carton Barcode</label>
                    <Input
                      ref={cartonBarcodeInputRef}
                      placeholder="Scan carton barcode or type manually"
                      value={formData.cartonBarcode}
                      onChange={(e) => setFormData({ ...formData, cartonBarcode: e.target.value })}
                      onKeyDown={(e) => {
                        // When Enter is pressed, move to track stock checkbox or submit button
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          const trackStockCheckbox = document.querySelector('input[type="checkbox"]') as HTMLInputElement
                          if (trackStockCheckbox) {
                            trackStockCheckbox.focus()
                          }
                        }
                      }}
                    />
                  </div>
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
                {!editingProduct && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={submitting}
                    onClick={() => handleSubmit(undefined, true)}
                  >
                    {submitting ? 'Saving...' : 'Save & Add Another'}
                  </Button>
                )}
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Saving...' : editingProduct ? 'Update' : 'Create'}
                </Button>
              </div>
            </form>
      </Modal>

      {/* Products List */}
      {loading ? (
        <div className="text-center py-8">Loading...</div>
      ) : products.length === 0 ? (
        <EmptyState
          title={searchTerm ? 'No products found' : 'No products yet'}
          description={
            searchTerm
              ? 'Try a different search term.'
              : 'Create your first product to get started.'
          }
        />
      ) : (
        <>
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <TR>
                  <TH>
                    <button
                      onClick={() => handleSort('name')}
                      className="flex items-center gap-1 hover:text-blue-600 transition-colors w-full text-left"
                    >
                      Name
                      {renderSortIcon('name')}
                    </button>
                  </TH>
                  <TH>
                    <button
                      onClick={() => handleSort('sku')}
                      className="flex items-center gap-1 hover:text-blue-600 transition-colors w-full text-left"
                    >
                      SKU
                      {renderSortIcon('sku')}
                    </button>
                  </TH>
                  <TH>
                    <button
                      onClick={() => handleSort('barcode')}
                      className="flex items-center gap-1 hover:text-blue-600 transition-colors w-full text-left"
                    >
                      Barcode
                      {renderSortIcon('barcode')}
                    </button>
                  </TH>
                  <TH>
                    <button
                      onClick={() => handleSort('unit')}
                      className="flex items-center gap-1 hover:text-blue-600 transition-colors w-full text-left"
                    >
                      Unit
                      {renderSortIcon('unit')}
                    </button>
                  </TH>
                  <TH className="text-right">
                    <button
                      onClick={() => handleSort('price')}
                      className="flex items-center gap-1 justify-end ml-auto hover:text-blue-600 transition-colors"
                    >
                      Price
                      {renderSortIcon('price')}
                    </button>
                  </TH>
                  <TH className="text-right">
                    <button
                      onClick={() => handleSort('costPrice')}
                      className="flex items-center gap-1 justify-end ml-auto hover:text-blue-600 transition-colors"
                    >
                      Cost Price
                      {renderSortIcon('costPrice')}
                    </button>
                  </TH>
                  <TH className="text-center">
                    <button
                      onClick={() => handleSort('stock')}
                      className="flex items-center gap-1 justify-center mx-auto hover:text-blue-600 transition-colors"
                    >
                      Stock
                      {renderSortIcon('stock')}
                    </button>
                  </TH>
                  <TH className="text-center">
                    <button
                      onClick={() => handleSort('trackStock')}
                      className="flex items-center gap-1 justify-center mx-auto hover:text-blue-600 transition-colors"
                    >
                      Track Stock
                      {renderSortIcon('trackStock')}
                    </button>
                  </TH>
                  <TH className="text-right">
                    <button
                      onClick={() => handleSort('reorderLevel')}
                      className="flex items-center gap-1 justify-end ml-auto hover:text-blue-600 transition-colors"
                    >
                      Reorder Level
                      {renderSortIcon('reorderLevel')}
                    </button>
                  </TH>
                  <TH className="text-center">Actions</TH>
                </TR>
              </THead>
              <tbody>
                {sortedProducts.length === 0 ? (
                  <EmptyRow colSpan={10} message="No products" />
                ) : (
                  sortedProducts.map((product) => {
                    const stock = product.stock ?? 0
                    const isLowStock = product.trackStock && 
                      product.reorderLevel !== null && 
                      stock <= product.reorderLevel
                    const isOutOfStock = product.trackStock && stock <= 0
                    
                    return (
                      <TR key={product.id} className={product.archivedAt ? 'opacity-60' : undefined}>
                        <TD>
                          <span className="flex items-center gap-2">
                            {product.name}
                            {product.archivedAt && (
                              <span className="rounded-full bg-[hsl(var(--muted))] px-2 py-0.5 text-xs font-medium text-[hsl(var(--muted-foreground))]">
                                Archived
                              </span>
                            )}
                          </span>
                        </TD>
                        <TD>{product.sku || '-'}</TD>
                        <TD>{product.barcode || '-'}</TD>
                        <TD>{product.unit}</TD>
                        <TD className="text-right">{formatCurrency(parseFloat(product.price), '')}</TD>
                        <TD className="text-right">
                          {product.costPrice ? formatCurrency(parseFloat(product.costPrice), '') : '-'}
                        </TD>
                        <TD className="text-center">
                          {product.trackStock ? (
                            <span className={
                              isOutOfStock 
                                ? 'text-red-600 font-semibold' 
                                : isLowStock 
                                  ? 'text-orange-600 font-medium' 
                                  : 'text-green-600'
                            }>
                              {formatNumber(stock)} {product.unit}
                              {isOutOfStock && ' (Out)'}
                              {isLowStock && !isOutOfStock && ' (Low)'}
                            </span>
                          ) : (
                            <span className="text-[hsl(var(--muted-foreground))]">-</span>
                          )}
                        </TD>
                        <TD className="text-center">
                          {product.trackStock ? (
                            <span className="text-green-600">Yes</span>
                          ) : (
                            <span className="text-[hsl(var(--muted-foreground))]">No</span>
                          )}
                        </TD>
                        <TD className="text-right">{product.reorderLevel || '-'}</TD>
                        <TD className="text-center">
                          <div className="flex gap-2 justify-center">
                            {product.trackStock && (
                              <IconButton variant="neutral" label="Adjust stock" onClick={() => openAdjustmentModal(product)}>
                                <Package className="h-4 w-4" />
                              </IconButton>
                            )}
                            <IconButton variant="neutral" label="Edit product" onClick={() => openEditForm(product)}>
                              <Pencil className="h-4 w-4" />
                            </IconButton>
                            <IconButton
                              variant="neutral"
                              label={product.archivedAt ? 'Restore product' : 'Archive product'}
                              onClick={() => handleArchiveToggle(product)}
                              disabled={archivingId === product.id}
                            >
                              {archivingId === product.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : product.archivedAt ? (
                                <ArchiveRestore className="h-4 w-4" />
                              ) : (
                                <Archive className="h-4 w-4" />
                              )}
                            </IconButton>
                            <IconButton
                              variant="danger"
                              label="Delete product"
                              onClick={() => handleDeleteClick(product)}
                              disabled={deletingProductId === product.id}
                            >
                              {deletingProductId === product.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </IconButton>
                          </div>
                        </TD>
                      </TR>
                    )
                  })
                )}
              </tbody>
            </Table>
          </div>

          {/* Pagination + page size */}
          <div className="mt-4 flex flex-col sm:flex-row justify-between items-center gap-3">
            <div className="flex items-center gap-3 text-sm text-gray-600">
              <span>
                Showing {products.length} of {pagination.total} products
              </span>
              <label className="flex items-center gap-1">
                <span>Per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value))
                    setCurrentPage(1)
                  }}
                  className="border border-gray-300 rounded px-2 py-1 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {[25, 50, 100, 200].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {pagination.totalPages > 1 && (
              <div className="flex gap-2 items-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <span className="px-2 text-sm text-gray-600">
                  Page {currentPage} of {pagination.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))}
                  disabled={currentPage === pagination.totalPages}
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        </>
      )}

      {/* Stock Adjustment Modal */}
      {showAdjustmentModal && adjustingProduct && (
        <Modal open onClose={closeAdjustmentModal} title="Adjust Stock" size="sm">
            <p className="text-sm text-gray-600 mb-4">
              Product: <span className="font-semibold">{adjustingProduct.name}</span>
            </p>
            <p className="text-sm text-gray-600 mb-4">
              Current Stock: <span className="font-semibold">
                {formatNumber(adjustingProduct.stock ?? 0)} {adjustingProduct.unit}
              </span>
            </p>

            {adjustmentError && (
              <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
                {adjustmentError}
              </div>
            )}

            <form onSubmit={handleAdjustmentSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Adjustment Type <span className="text-red-500">*</span>
                  </label>
                  <Select
                    value={adjustmentData.type}
                    onChange={(e) => setAdjustmentData({
                      ...adjustmentData,
                      type: e.target.value as any,
                    })}
                    required
                  >
                    <option value="ADJUSTMENT">General Adjustment</option>
                    <option value="DAMAGE">Damage</option>
                    <option value="EXPIRY">Expiry</option>
                    <option value="RETURN">Return</option>
                    <option value="SELF_USE">Self Use</option>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Quantity <span className="text-red-500">*</span>
                    <span className="text-xs text-gray-500 ml-2">
                      (Positive to add, negative to reduce)
                    </span>
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    value={adjustmentData.quantity}
                    onChange={(e) => setAdjustmentData({
                      ...adjustmentData,
                      quantity: e.target.value,
                    })}
                    placeholder="e.g., 10 or -5"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Example: +10 to add 10 units, -5 to reduce 5 units
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Notes (Optional)
                  </label>
                  <textarea
                    value={adjustmentData.notes}
                    onChange={(e) => setAdjustmentData({
                      ...adjustmentData,
                      notes: e.target.value,
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                    rows={3}
                    placeholder="Reason for adjustment..."
                  />
                </div>
              </div>

              <div className="flex gap-2 justify-end mt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeAdjustmentModal}
                  disabled={adjusting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={adjusting}>
                  {adjusting ? 'Adjusting...' : 'Adjust Stock'}
                </Button>
              </div>
            </form>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && productToDelete && (
        <Modal
          open
          onClose={() => {
            setShowDeleteConfirm(false)
            setProductToDelete(null)
          }}
          title="Delete Product"
          size="sm"
        >
            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to delete <span className="font-semibold">{productToDelete.name}</span>?
            </p>
            <p className="text-sm text-red-600 mb-6">
              This action cannot be undone. Products used in sales cannot be deleted. Archive them instead to hide them everywhere while keeping their sales history.
            </p>
            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowDeleteConfirm(false)
                  setProductToDelete(null)
                }}
                disabled={deletingProductId !== null}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={handleDeleteConfirm}
                disabled={deletingProductId !== null}
              >
                {deletingProductId ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
        </Modal>
      )}
    </div>
  )
}