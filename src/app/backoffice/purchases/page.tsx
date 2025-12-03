'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { savePurchaseLocally, syncPendingPurchasesBatch } from '@/lib/offline/purchases'
import { cuid } from '@/lib/utils/cuid'
import { Pencil, Trash2, Loader2, Plus } from 'lucide-react'
import { useToast } from '@/components/ui/ToastProvider'
import { formatNumber } from '@/lib/utils/money'
import { Table, THead, TR, TH, TD, EmptyRow } from '@/components/ui/DataTable'

interface Product {
  id: string
  name: string
  unit: string
  price: string
  cartonSize: number | null
  barcode?: string | null
  sku?: string | null
}

interface Supplier {
  id: string
  name: string
}

interface PurchaseLine {
  productId: string
  quantity: string
  unitCost: string
  unit: 'piece' | 'carton'
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
  const { show } = useToast()
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null)
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
  const [showQuickAddProduct, setShowQuickAddProduct] = useState(false)
  const [deletingPurchaseId, setDeletingPurchaseId] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [purchaseToDelete, setPurchaseToDelete] = useState<Purchase | null>(null)
  const [productSearchTerms, setProductSearchTerms] = useState<Record<number, string>>({})
  const [openDropdowns, setOpenDropdowns] = useState<Record<number, boolean>>({})
  const [dropdownPositions, setDropdownPositions] = useState<Record<number, { top: number; left: number; width: number }>>({})
  const inputRefs = useRef<Record<number, HTMLInputElement | null>>({})
  const dropdownRefs = useRef<Record<number, HTMLDivElement | null>>({})

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      const isClickOnInput = Object.values(inputRefs.current).some(ref => ref?.contains(target))
      const isClickOnDropdown = Object.values(dropdownRefs.current).some(ref => ref?.contains(target))
      
      if (!isClickOnInput && !isClickOnDropdown) {
        setOpenDropdowns({})
      }
    }

    if (Object.values(openDropdowns).some(isOpen => isOpen)) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [openDropdowns])
  const [quickAddProductData, setQuickAddProductData] = useState({
    name: '',
    unit: 'pcs',
    price: '',
    costPrice: '',
    barcode: '',
    trackStock: true,
  })
  const [addingProduct, setAddingProduct] = useState(false)

  // Per-page sync removed; handled by global background sync orchestrator

  const fetchPurchases = useCallback(async () => {
    if (!user?.currentShopId) return

    try {
      setLoading(true)
      const isOnline = typeof navigator !== 'undefined' && navigator.onLine
      
      if (isOnline) {
        try {
          const params = new URLSearchParams({
            page: currentPage.toString(),
            limit: '50',
          })

          const response = await fetch(`/api/purchases?${params}`)
          if (response.ok) {
            const data: PurchasesResponse = await response.json()
            setPurchases(data.purchases || [])
            setPagination(data.pagination)
            setLoading(false)
            return
          }
        } catch (apiError) {
          console.warn('API failed, falling back to cache:', apiError)
        }
      }
      
      // Offline or API failed: use cached purchases
      const { getPurchases } = await import('@/lib/offline/indexedDb')
      const cached = await getPurchases(user.currentShopId)
      const rows = cached.map((p) => ({
        id: p.id,
        date: new Date(p.date || p.createdAt).toISOString().split('T')[0],
        reference: p.reference || null,
        notes: p.notes || null,
        supplier: p.supplierId ? { id: p.supplierId, name: 'Supplier' } : null,
        createdBy: null,
        _count: { lines: p.lines.length },
        lines: p.lines.map((l) => ({
          id: l.productId,
          product: { id: l.productId, name: 'Product', unit: 'pcs' },
          quantity: l.quantity.toString(),
          unitCost: l.unitCost?.toString() || null,
        })),
      }))
      
      setPurchases(rows)
      setPagination({
        page: 1,
        limit: 50,
        total: rows.length,
        totalPages: 1,
      })
    } catch (err) {
      console.error('Failed to fetch purchases:', err)
    } finally {
      setLoading(false)
    }
  }, [user?.currentShopId, currentPage])

  const fetchProducts = useCallback(async () => {
    if (!user?.currentShopId) return
    try {
      const isOnline = typeof navigator !== 'undefined' && navigator.onLine
      
      if (isOnline) {
        try {
          const response = await fetch('/api/products?limit=1000')
          if (response.ok) {
            const data = await response.json()
            setProducts(data.products || [])
            return
          }
        } catch (apiError) {
          console.warn('API failed, falling back to cache:', apiError)
        }
      }
      
      // Offline or API failed: use cache
      const { getProductsWithCache } = await import('@/lib/offline/products')
      const cached = await getProductsWithCache(user.currentShopId, isOnline)
      setProducts(cached.map((p: any) => ({
        id: p.id,
        name: p.name,
        unit: p.unit,
        price: p.price.toString(),
        cartonSize: p.cartonSize ?? null,
        barcode: p.barcode ?? null,
        sku: p.sku ?? null, // SKU may not be in cached type
      })))
    } catch (err) {
      console.error('Failed to fetch products:', err)
    }
  }, [user?.currentShopId])

  const fetchSuppliers = useCallback(async () => {
    if (!user?.currentShopId) return
    try {
      const isOnline = typeof navigator !== 'undefined' && navigator.onLine
      
      if (isOnline) {
        try {
          const response = await fetch('/api/suppliers?limit=1000')
          if (response.ok) {
            const data = await response.json()
            setSuppliers(data.suppliers || [])
            return
          }
        } catch (apiError) {
          console.warn('API failed, falling back to cache:', apiError)
        }
      }
      
      // Offline or API failed: use cache
      const { getSuppliersWithCache } = await import('@/lib/offline/data')
      const cached = await getSuppliersWithCache(user.currentShopId, isOnline)
      setSuppliers(cached.map((s) => ({
        id: s.id,
        name: s.name,
        phone: s.phone,
        notes: s.notes,
      })))
    } catch (err) {
      console.error('Failed to fetch suppliers:', err)
    }
  }, [user?.currentShopId])

  useEffect(() => {
    if (user?.currentShopId) {
      fetchPurchases()
      fetchProducts()
      fetchSuppliers()
    }
  }, [user?.currentShopId, fetchPurchases, fetchProducts, fetchSuppliers])

  async function handleQuickAddProduct() {
    if (!quickAddProductData.name || !quickAddProductData.price) {
      setError('Product name and price are required')
      return
    }

    setAddingProduct(true)
    setError('')

    try {
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: quickAddProductData.name,
          unit: quickAddProductData.unit,
          price: parseFloat(quickAddProductData.price),
          costPrice: quickAddProductData.costPrice ? parseFloat(quickAddProductData.costPrice) : undefined,
          barcode: quickAddProductData.barcode || undefined,
          trackStock: quickAddProductData.trackStock,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create product')
      }

      const data = await response.json()
      
      // Refresh products list
      await fetchProducts()
      
      // Add the new product to the current purchase line
      const newLines = [...formData.lines]
      const emptyLineIndex = newLines.findIndex(line => !line.productId)
      if (emptyLineIndex >= 0) {
        newLines[emptyLineIndex].productId = data.product.id
        if (quickAddProductData.costPrice) {
          newLines[emptyLineIndex].unitCost = quickAddProductData.costPrice
        }
      } else {
        newLines.push({
          productId: data.product.id,
          quantity: '',
          unitCost: quickAddProductData.costPrice || '',
          unit: 'piece',
        })
      }
      setFormData({ ...formData, lines: newLines })

      // Close quick add modal
      setShowQuickAddProduct(false)
      setQuickAddProductData({
        name: '',
        unit: 'pcs',
        price: '',
        costPrice: '',
        barcode: '',
        trackStock: true,
      })
    } catch (err: any) {
      setError(err.message || 'Failed to create product')
    } finally {
      setAddingProduct(false)
    }
  }

  function openCreateForm() {
    setEditingPurchase(null)
    setFormData({
      supplierId: '',
      date: new Date().toISOString().split('T')[0],
      reference: '',
      notes: '',
      lines: [{ productId: '', quantity: '', unitCost: '', unit: 'piece' }],
    })
    setError('')
    setProductSearchTerms({})
    setOpenDropdowns({})
    setShowForm(true)
  }

  function openEditForm(purchase: Purchase) {
    setEditingPurchase(purchase)
    setFormData({
      supplierId: purchase.supplier?.id || '',
      date: new Date(purchase.date).toISOString().split('T')[0],
      reference: purchase.reference || '',
      notes: purchase.notes || '',
      lines: purchase.lines.map((line) => ({
        productId: line.product.id,
        quantity: formatNumber(parseFloat(line.quantity)),
        unitCost: line.unitCost ? formatNumber(parseFloat(line.unitCost)) : '',
        unit: 'piece' as const,
      })),
    })
    setError('')
    setProductSearchTerms({})
    setOpenDropdowns({})
    setShowForm(true)
  }

  const handleDeleteClick = (purchase: Purchase) => {
    setPurchaseToDelete(purchase)
    setShowDeleteConfirm(true)
  }

  const handleDeleteConfirm = async () => {
    if (!purchaseToDelete) return

    setDeletingPurchaseId(purchaseToDelete.id)
    try {
      const response = await fetch(`/api/purchases/${purchaseToDelete.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete purchase')
      }

      show({
        title: 'Success',
        message: 'Purchase deleted successfully',
        variant: 'success',
      })

      setShowDeleteConfirm(false)
      setPurchaseToDelete(null)
      await fetchPurchases()
    } catch (err: any) {
      show({
        title: 'Error',
        message: err.message || 'Failed to delete purchase',
        variant: 'destructive',
      })
    } finally {
      setDeletingPurchaseId(null)
    }
  }

  function addLine() {
    setFormData({
      ...formData,
      lines: [...formData.lines, { productId: '', quantity: '', unitCost: '', unit: 'piece' }],
    })
    // Clear search term for new line
    setProductSearchTerms({ ...productSearchTerms, [formData.lines.length]: '' })
  }

  function removeLine(index: number) {
    setFormData({
      ...formData,
      lines: formData.lines.filter((_, i) => i !== index),
    })
  }

  function updateLine(index: number, field: keyof PurchaseLine, value: string) {
    const newLines = [...formData.lines]
    // @ts-ignore
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

      const isOnline = typeof navigator !== 'undefined' && navigator.onLine

      if (editingPurchase && isOnline) {
        // Update existing purchase
        const response = await fetch(`/api/purchases/${editingPurchase.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            supplierId: formData.supplierId || undefined,
            date: formData.date,
            reference: formData.reference || undefined,
            notes: formData.notes || undefined,
            lines: validLines.map((line) => ({
              productId: line.productId,
              quantity: line.unit === 'carton'
                ? parseFloat(line.quantity) * (products.find(p => p.id === line.productId)?.cartonSize || 1)
                : parseFloat(line.quantity),
              unitCost: line.unitCost ? parseFloat(line.unitCost) : undefined,
            })),
          }),
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Failed to update purchase')
        }

        show({ message: 'Purchase updated successfully', variant: 'success' })
      } else {
        // Create new purchase
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
          quantity: line.unit === 'carton'
            ? parseFloat(line.quantity) * (products.find(p => p.id === line.productId)?.cartonSize || 1)
            : parseFloat(line.quantity),
          unitCost: line.unitCost ? parseFloat(line.unitCost) : undefined,
        })),
      }

      // Save locally (offline-first)
      await savePurchaseLocally(purchase)

      // Attempt sync if online
        if (isOnline) {
        try {
          const syncResult = await syncPendingPurchasesBatch(user.currentShopId)
          if (syncResult.failed > 0) {
            console.warn(`Some purchases failed to sync: ${syncResult.failed} failed`)
            // Don't throw error, purchase is saved locally and will retry
          }
        } catch (syncErr: any) {
          console.error('Sync error:', syncErr)
          // Don't throw - purchase is saved locally, will sync later
          }
        }
      }

      // Reset form and refresh list
      setShowForm(false)
      setEditingPurchase(null)
      await fetchPurchases()
      router.refresh()
    } catch (err: any) {
      console.error('Purchase submission error:', err)
      setError(err.message || err.error || 'An error occurred. Please try again.')
      show({
        title: 'Error',
        message: err.message || err.error || 'An error occurred. Please try again.',
        variant: 'destructive',
      })
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
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>New Purchase</span>
        </button>
      </div>

      {/* Purchase Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">
              {editingPurchase ? 'Edit Purchase' : 'New Purchase'}
            </h2>

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
                            <div className="flex gap-1">
                              <div className="flex-1 relative">
                                <input
                                  ref={(el) => {
                                    inputRefs.current[index] = el
                                  }}
                                  type="text"
                                required={index === 0}
                                  value={line.productId 
                                    ? products.find(p => p.id === line.productId)?.name || ''
                                    : productSearchTerms[index] || ''
                                  }
                                  onChange={(e) => {
                                    const searchTerm = e.target.value
                                    const selectedProduct = products.find(p => p.id === line.productId)
                                    
                                    // If user is typing and there's a selected product, clear it if they're changing the text
                                    if (selectedProduct && searchTerm !== selectedProduct.name) {
                                      updateLine(index, 'productId', '')
                                    }
                                    
                                    setProductSearchTerms({ ...productSearchTerms, [index]: searchTerm })
                                    
                                    // Update dropdown position when typing
                                    const input = inputRefs.current[index]
                                    if (input) {
                                      const rect = input.getBoundingClientRect()
                                      const viewportHeight = window.innerHeight
                                      const spaceBelow = viewportHeight - rect.bottom
                                      const spaceAbove = rect.top
                                      const dropdownHeight = 240 // max-h-60 = 240px
                                      
                                      // Position above if not enough space below, but enough space above
                                      const positionAbove = spaceBelow < dropdownHeight && spaceAbove > spaceBelow
                                      
                                      setDropdownPositions({
                                        ...dropdownPositions,
                                        [index]: {
                                          top: positionAbove 
                                            ? rect.top + window.scrollY - dropdownHeight - 4
                                            : rect.bottom + window.scrollY + 4,
                                          left: rect.left + window.scrollX,
                                          width: rect.width,
                                        },
                                      })
                                    }
                                    
                                    setOpenDropdowns({ ...openDropdowns, [index]: true })
                                    
                                    // If exact match found, select it
                                    const exactMatch = products.find(
                                      p => p.name.toLowerCase() === searchTerm.toLowerCase()
                                    )
                                    if (exactMatch) {
                                      updateLine(index, 'productId', exactMatch.id)
                                      setProductSearchTerms({ ...productSearchTerms, [index]: '' })
                                      setOpenDropdowns({ ...openDropdowns, [index]: false })
                                    } else if (!searchTerm && !selectedProduct) {
                                      updateLine(index, 'productId', '')
                                    }
                                  }}
                                  onKeyDown={(e) => {
                                    // Allow clearing with Backspace/Delete when input is empty
                                    if ((e.key === 'Backspace' || e.key === 'Delete') && line.productId) {
                                      const currentValue = line.productId 
                                        ? products.find(p => p.id === line.productId)?.name || ''
                                        : productSearchTerms[index] || ''
                                      if (!currentValue || currentValue.length <= 1) {
                                        updateLine(index, 'productId', '')
                                        setProductSearchTerms({ ...productSearchTerms, [index]: '' })
                                      }
                                    }
                                    // Close dropdown on Escape
                                    if (e.key === 'Escape') {
                                      setOpenDropdowns({ ...openDropdowns, [index]: false })
                                    }
                                  }}
                                  onFocus={(e) => {
                                    const input = e.currentTarget
                                    const rect = input.getBoundingClientRect()
                                    const viewportHeight = window.innerHeight
                                    const spaceBelow = viewportHeight - rect.bottom
                                    const spaceAbove = rect.top
                                    const dropdownHeight = 240 // max-h-60 = 240px
                                    
                                    // Position above if not enough space below, but enough space above
                                    const positionAbove = spaceBelow < dropdownHeight && spaceAbove > spaceBelow
                                    
                                    setDropdownPositions({
                                      ...dropdownPositions,
                                      [index]: {
                                        top: positionAbove 
                                          ? rect.top + window.scrollY - dropdownHeight - 4
                                          : rect.bottom + window.scrollY + 4,
                                        left: rect.left + window.scrollX,
                                        width: rect.width,
                                      },
                                    })
                                    // Close other dropdowns when opening this one
                                    const otherDropdowns: Record<number, boolean> = {}
                                    Object.keys(openDropdowns).forEach(k => {
                                      otherDropdowns[parseInt(k)] = false
                                    })
                                    otherDropdowns[index] = true
                                    setOpenDropdowns(otherDropdowns)
                                  }}
                                  onBlur={() => {
                                    // Delay closing to allow click on dropdown item
                                    setTimeout(() => {
                                      setOpenDropdowns({ ...openDropdowns, [index]: false })
                                    }, 200)
                                  }}
                                  placeholder="Search or select product..."
                                  className="w-full px-2 py-1 border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() => setShowQuickAddProduct(true)}
                                className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 whitespace-nowrap"
                                title="Quick Add Product"
                              >
                                + New Product
                              </button>
                            </div>
                          </td>
                          <td className="border p-2">
                            <div className="flex gap-1">
                              <input
                                type="number"
                                step="0.001"
                                required={index === 0}
                                value={line.quantity}
                                onChange={(e) =>
                                  updateLine(index, 'quantity', e.target.value)
                                }
                                className="w-20 px-2 py-1 border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                placeholder="Qty"
                              />
                              {(() => {
                                const selectedProduct = products.find(p => p.id === line.productId)
                                const hasCarton = selectedProduct?.cartonSize && selectedProduct.cartonSize > 0
                                if (!hasCarton) return null
                                return (
                                  <select
                                    value={line.unit}
                                    onChange={(e) => updateLine(index, 'unit', e.target.value as 'piece' | 'carton')}
                                    className="w-24 px-1 py-1 border rounded text-sm bg-gray-50"
                                  >
                                    <option value="piece">Piece</option>
                                    <option value="carton">Carton</option>
                                  </select>
                                )
                              })()}
                            </div>
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
                              placeholder={(() => {
                                const selectedProduct = products.find(p => p.id === line.productId)
                                const hasCarton = selectedProduct?.cartonSize && selectedProduct.cartonSize > 0
                                return line.unit === 'carton' && hasCarton 
                                  ? `Per carton (optional)` 
                                  : `Per ${selectedProduct?.unit || 'piece'} (optional)`
                              })()}
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
                  {submitting ? (editingPurchase ? 'Updating...' : 'Creating...') : (editingPurchase ? 'Update Purchase' : 'Create Purchase')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Add Product Modal */}
      {showQuickAddProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Quick Add Product</h2>
            <p className="text-sm text-gray-600 mb-4">
              Create a product quickly and add it to this purchase
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Product Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={quickAddProductData.name}
                  onChange={(e) =>
                    setQuickAddProductData({ ...quickAddProductData, name: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter product name"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Unit <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={quickAddProductData.unit}
                    onChange={(e) =>
                      setQuickAddProductData({ ...quickAddProductData, unit: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="pcs">pcs</option>
                    <option value="kg">kg</option>
                    <option value="g">g</option>
                    <option value="L">L</option>
                    <option value="mL">mL</option>
                    <option value="pack">pack</option>
                    <option value="box">box</option>
                    <option value="dozen">dozen</option>
                    <option value="piece">piece</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Sale Price <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={quickAddProductData.price}
                    onChange={(e) =>
                      setQuickAddProductData({ ...quickAddProductData, price: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Cost Price</label>
                  <input
                    type="number"
                    step="0.01"
                    value={quickAddProductData.costPrice}
                    onChange={(e) =>
                      setQuickAddProductData({ ...quickAddProductData, costPrice: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Optional"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Barcode</label>
                  <input
                    type="text"
                    value={quickAddProductData.barcode}
                    onChange={(e) =>
                      setQuickAddProductData({ ...quickAddProductData, barcode: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Optional"
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={quickAddProductData.trackStock}
                    onChange={(e) =>
                      setQuickAddProductData({ ...quickAddProductData, trackStock: e.target.checked })
                    }
                    className="w-4 h-4"
                  />
                  <span className="text-sm">Track Stock</span>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={() => {
                  setShowQuickAddProduct(false)
                  setQuickAddProductData({
                    name: '',
                    unit: 'pcs',
                    price: '',
                    costPrice: '',
                    barcode: '',
                    trackStock: true,
                  })
                }}
                className="px-4 py-2 border rounded hover:bg-gray-50"
                disabled={addingProduct}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleQuickAddProduct}
                disabled={addingProduct || !quickAddProductData.name || !quickAddProductData.price}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
              >
                {addingProduct ? 'Adding...' : 'Add Product'}
              </button>
            </div>
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
            <Table>
              <THead>
                <TR>
                  <TH>Date</TH>
                  <TH>Supplier</TH>
                  <TH>Reference</TH>
                  <TH>Items</TH>
                  <TH>Created By</TH>
                  <TH>Notes</TH>
                  <TH className="text-center">Actions</TH>
                </TR>
              </THead>
              <tbody>
                {purchases.length === 0 ? (
                  <EmptyRow colSpan={7} message="No purchases yet. Create your first purchase!" />
                ) : (
                  purchases.map((purchase) => (
                    <TR key={purchase.id}>
                      <TD>{new Date(purchase.date).toLocaleDateString()}</TD>
                      <TD>{purchase.supplier?.name || '-'}</TD>
                      <TD>{purchase.reference || '-'}</TD>
                      <TD>
                        <div className="text-sm space-y-0.5">
                          {purchase.lines && purchase.lines.length > 0 ? (
                            purchase.lines.slice(0, 3).map((line, idx) => (
                              <div key={idx} className="text-gray-700">
                                {line.product.name} × {formatNumber(parseFloat(line.quantity))} {line.product.unit}
                              </div>
                            ))
                          ) : (
                            <span className="text-gray-400">{purchase._count.lines} items</span>
                          )}
                          {purchase.lines && purchase.lines.length > 3 && (
                            <div className="text-xs text-gray-500">
                              +{purchase.lines.length - 3} more
                            </div>
                          )}
                        </div>
                      </TD>
                      <TD>{purchase.createdBy?.name || '-'}</TD>
                      <TD>{purchase.notes || '-'}</TD>
                      <TD className="text-center">
                        <div className="flex gap-2 justify-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              openEditForm(purchase)
                            }}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Edit"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteClick(purchase)
                            }}
                            disabled={deletingPurchaseId === purchase.id}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded disabled:opacity-50 transition-colors"
                            title="Delete"
                          >
                            {deletingPurchaseId === purchase.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        </div>
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

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && purchaseToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Delete Purchase</h2>
            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to delete this purchase from{' '}
              <span className="font-semibold">
                {new Date(purchaseToDelete.date).toLocaleDateString()}
              </span>?
            </p>
            <p className="text-sm text-red-600 mb-6">
              This will reverse all stock updates from this purchase. This action cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteConfirm(false)
                  setPurchaseToDelete(null)
                }}
                disabled={deletingPurchaseId !== null}
                className="px-4 py-2 border rounded hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={deletingPurchaseId !== null}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
              >
                {deletingPurchaseId ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Product Dropdown Portal - Renders outside modal for proper visibility */}
      {typeof window !== 'undefined' && Object.keys(openDropdowns).some(key => openDropdowns[parseInt(key)]) && createPortal(
        <>
          {Object.entries(openDropdowns).map(([key, isOpen]) => {
            const index = parseInt(key)
            if (!isOpen || !dropdownPositions[index]) return null
            
            // Get list of product IDs already selected in other line items
            const selectedProductIds = formData.lines
              .map((line, idx) => idx !== index ? line.productId : null)
              .filter((id): id is string => Boolean(id))
            
            const filteredProducts = products
              .filter((product) => {
                // Exclude products already selected in other line items
                if (selectedProductIds.includes(product.id)) {
                  return false
                }
                
                // Apply search filter
                const searchTerm = productSearchTerms[index] || ''
                if (!searchTerm) return true
                const searchLower = searchTerm.toLowerCase()
                return (
                  product.name.toLowerCase().includes(searchLower) ||
                  (product.barcode && product.barcode.toLowerCase().includes(searchLower)) ||
                  (product.sku && product.sku.toLowerCase().includes(searchLower))
                )
              })
              .slice(0, 20)

            return (
              <div
                key={index}
                ref={(el) => {
                  dropdownRefs.current[index] = el
                }}
                className="fixed z-[9999] bg-white border border-gray-300 rounded-lg shadow-xl max-h-60 overflow-y-auto"
                style={{
                  top: `${dropdownPositions[index].top}px`,
                  left: `${dropdownPositions[index].left}px`,
                  width: `${dropdownPositions[index].width}px`,
                }}
                onMouseDown={(e) => e.preventDefault()} // Prevent blur when clicking dropdown
              >
                {filteredProducts.length > 0 ? (
                  filteredProducts.map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => {
                        updateLine(index, 'productId', product.id)
                        setProductSearchTerms({ ...productSearchTerms, [index]: '' })
                        setOpenDropdowns({ ...openDropdowns, [index]: false })
                        inputRefs.current[index]?.blur()
                      }}
                      className="w-full px-3 py-2 text-left hover:bg-blue-50 focus:bg-blue-50 focus:outline-none border-b border-gray-100 last:border-b-0 transition-colors"
                    >
                      <div className="font-medium">{product.name}</div>
                      <div className="text-xs text-gray-500">
                        {product.unit}
                        {product.cartonSize ? ` • Carton: ${product.cartonSize}` : ''}
                        {product.barcode ? ` • ${product.barcode}` : ''}
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-2 text-sm text-gray-500 text-center">
                    No products found
                  </div>
                )}
              </div>
            )
          })}
        </>,
        document.body
      )}
    </div>
  )
}