'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { useLanguage } from '@/contexts/LanguageContext'
import { getProductsWithCache, findProductByBarcode, searchCachedProducts, Product } from '@/lib/offline/products'
import { saveSale } from '@/lib/offline/sales'
import { getCustomers, saveCustomers } from '@/lib/offline/indexedDb'
import { cuid } from '@/lib/utils/cuid'
import { sumCartLines, calculateTotals } from '@/lib/utils/money'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { useToast } from '@/components/ui/ToastProvider'

// Product interface is imported from lib/offline/products

interface Customer {
  id: string
  name: string
  phone: string | null
}

interface CartItem {
  product: Product
  quantity: number
  unitPrice: number
  lineTotal: number
}

interface ReceiptItem {
  name: string
  quantity: number
  unit: string | null
  unitPrice: number
  lineTotal: number
}

interface ReceiptData {
  id: string
  timestamp: string
  shopName: string
  shopCity?: string | null
  items: ReceiptItem[]
  subtotal: number
  discount: number
  total: number
  paymentStatus: 'PAID' | 'UDHAAR'
  paymentMethod?: 'CASH' | 'CARD' | 'OTHER'
  amountReceived?: number
  change?: number
  customerName?: string
}

export default function POSPage() {
  const { user } = useAuth()
  const { show } = useToast()
  const router = useRouter()
  const isOnline = useOnlineStatus()
  const { t, language } = useLanguage()

  const [products, setProducts] = useState<Product[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [cart, setCart] = useState<CartItem[]>([])
  const [barcodeInput, setBarcodeInput] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [discount, setDiscount] = useState(0)
  const [paymentStatus, setPaymentStatus] = useState<'PAID' | 'UDHAAR'>('PAID')
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'OTHER'>('CASH')
  const [customerId, setCustomerId] = useState('')
  const [amountReceived, setAmountReceived] = useState('')
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showReceiptModal, setShowReceiptModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null)

  // Edit Item State
  const [editingItem, setEditingItem] = useState<CartItem | null>(null)
  const [editForm, setEditForm] = useState({ quantity: 0, price: 0 })

  const barcodeInputRef = useRef<HTMLInputElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Load products once on mount from cache
  useEffect(() => {
    async function loadProducts() {
      if (!user?.currentShopId) return
      try {
        setLoading(true)
        // Always load from cache first for speed
        const productsList = await getProductsWithCache(user.currentShopId, isOnline)
        setProducts(productsList)
      } catch (err) {
        console.error('Failed to load products:', err)
      } finally {
        setLoading(false)
      }
    }

    async function loadCustomers() {
      if (!user?.currentShopId) return
      try {
        // Try to load from cache first
        const cached = await getCustomers(user.currentShopId)
        if (cached.length > 0) {
          setCustomers(cached.map((c) => ({ id: c.id, name: c.name, phone: c.phone })))
        } else if (isOnline) {
          // Fallback to API if cache is empty
          const response = await fetch('/api/customers?limit=1000')
          if (response.ok) {
            const data = await response.json()
            const customers = data.customers || []
            setCustomers(customers)
            // Cache for next time
            await saveCustomers(user.currentShopId, customers)
          }
        }
      } catch (err) {
        console.error('Failed to load customers:', err)
      }
    }

    if (user?.currentShopId) {
      loadProducts()
      loadCustomers()
    }
  }, [user?.currentShopId, isOnline])

  // Initialize edit form when editingItem changes
  useEffect(() => {
    if (editingItem) {
      setEditForm({ quantity: editingItem.quantity, price: editingItem.unitPrice })
    }
  }, [editingItem])

  useEffect(() => {
    // Focus barcode input on mount
    if (barcodeInputRef.current) {
      barcodeInputRef.current.focus()
    }
  }, [])

  function addToCart(product: Product, quantity: number = 1) {
    const existingItem = cart.find((item) => item.product.id === product.id)

    if (existingItem) {
      setCart(
        cart.map((item) =>
          item.product.id === product.id
            ? {
              ...item,
              quantity: item.quantity + quantity,
              lineTotal: (item.quantity + quantity) * item.unitPrice,
            }
            : item
        )
      )
    } else {
      setCart([
        ...cart,
        {
          product,
          quantity,
          unitPrice: product.price,
          lineTotal: product.price * quantity,
        },
      ])
    }

    // Clear inputs
    setBarcodeInput('')
    setSearchTerm('')
    if (barcodeInputRef.current) {
      barcodeInputRef.current.focus()
    }
  }

  function removeFromCart(productId: string) {
    setCart(cart.filter((item) => item.product.id !== productId))
  }

  function updateCartQuantity(productId: string, quantity: number) {
    if (quantity <= 0) {
      removeFromCart(productId)
      return
    }

    setCart(
      cart.map((item) =>
        item.product.id === productId
          ? {
            ...item,
            quantity,
            lineTotal: item.unitPrice * quantity,
          }
          : item
      )
    )
  }

  function saveEditedItem() {
    if (!editingItem) return

    if (editForm.quantity <= 0) {
      removeFromCart(editingItem.product.id)
    } else {
      setCart(cart.map(item =>
        item.product.id === editingItem.product.id
          ? {
            ...item,
            quantity: editForm.quantity,
            unitPrice: editForm.price,
            lineTotal: editForm.quantity * editForm.price
          }
          : item
      ))
    }
    setEditingItem(null)
  }

  async function handleBarcodeSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!barcodeInput.trim() || !user?.currentShopId) return

    try {
      // Try to find product by barcode in cache
      const product = await findProductByBarcode(user.currentShopId, barcodeInput.trim())
      if (product) {
        // Check if it's a carton barcode match
        const isCartonMatch = product.cartonBarcode === barcodeInput.trim()
        const quantity = isCartonMatch ? (product.cartonSize || 1) : 1

        addToCart(
          {
            id: product.id,
            name: product.name,
            barcode: product.barcode,
            unit: product.unit,
            price: product.price,
            trackStock: product.trackStock,
            cartonSize: product.cartonSize,
            cartonBarcode: product.cartonBarcode,
          },
          quantity
        )

        if (isCartonMatch) {
          show({ message: `Added carton of ${quantity} ${product.unit}`, variant: 'success' })
        }
      } else {
        // Fallback to products array search (in-memory)
        const foundProduct = products.find((p) => p.barcode === barcodeInput.trim() || p.cartonBarcode === barcodeInput.trim())
        if (foundProduct) {
          const isCartonMatch = foundProduct.cartonBarcode === barcodeInput.trim()
          const quantity = isCartonMatch ? (foundProduct.cartonSize || 1) : 1

          addToCart(foundProduct, quantity)

          if (isCartonMatch) {
            show({ message: `Added carton of ${quantity} ${foundProduct.unit}`, variant: 'success' })
          }
        } else {
          setError('Product not found with this barcode')
          setTimeout(() => setError(''), 3000)
        }
      }
    } catch (err) {
      console.error('Error finding product by barcode:', err)
      setError('Error finding product')
      setTimeout(() => setError(''), 3000)
    }
  }

  function handleProductSearch(product: Product) {
    addToCart(product, 1)
    setSearchTerm('')
    if (searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }

  function handleCompleteSale() {
    if (cart.length === 0) {
      setError('Cart is empty')
      return
    }

    if (paymentStatus === 'UDHAAR' && !customerId) {
      setError('Please select a customer for udhaar sale')
      return
    }

    setShowPaymentModal(true)
  }

  async function submitSale() {
    setError('')
    setSubmitting(true)

    try {
      if (!user?.currentShopId) {
        setError('No shop selected')
        setSubmitting(false)
        return
      }

      const subtotal = sumCartLines(cart)
      const { total } = calculateTotals(subtotal, discount)

      if (paymentStatus === 'PAID' && paymentMethod === 'CASH') {
        if (!amountReceived) {
          setError('Please enter amount received')
          setSubmitting(false)
          return
        }

        const parsedAmount = parseFloat(amountReceived)
        if (Number.isNaN(parsedAmount)) {
          setError('Amount received must be a valid number')
          setSubmitting(false)
          return
        }

        if (parsedAmount < total) {
          setError('Amount received is less than total due')
          setSubmitting(false)
          return
        }
      }

      // Generate client-side ID for offline-first
      const saleId = cuid()

      // Create sale input
      const sale = {
        id: saleId,
        shopId: user.currentShopId,
        customerId: paymentStatus === 'UDHAAR' ? customerId : undefined,
        items: cart.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          lineTotal: item.lineTotal,
        })),
        subtotal,
        discount,
        total,
        paymentStatus,
        paymentMethod: paymentStatus === 'PAID' ? paymentMethod : undefined,
        amountReceived:
          paymentStatus === 'PAID' && paymentMethod === 'CASH' && amountReceived
            ? parseFloat(amountReceived)
            : undefined,
      }

      // Save sale locally (offline-first) and sync if online
      const result = await saveSale(sale, isOnline)

      if (!result.saved) {
        setError('Failed to save sale')
        setSubmitting(false)
        return
      }

      // Build receipt data before clearing cart
      const shopInfo = user?.shops?.find((s) => s.shopId === user?.currentShopId)
      const selectedCustomer = customers.find((c) => c.id === customerId)
      const cashAmount =
        paymentStatus === 'PAID' && paymentMethod === 'CASH' && amountReceived
          ? parseFloat(amountReceived)
          : undefined
      const receiptSnapshot: ReceiptData = {
        id: saleId,
        timestamp: new Date().toISOString(),
        shopName: shopInfo?.shop.name || 'CartPOS Shop',
        shopCity: shopInfo?.shop.city || '',
        items: cart.map((item) => ({
          name: item.product.name,
          quantity: item.quantity,
          unit: item.product.unit,
          unitPrice: item.unitPrice,
          lineTotal: item.lineTotal,
        })),
        subtotal,
        discount,
        total,
        paymentStatus,
        paymentMethod: paymentStatus === 'PAID' ? paymentMethod : undefined,
        amountReceived: cashAmount,
        change: cashAmount ? cashAmount - total : undefined,
        customerName: selectedCustomer?.name,
      }

      setReceiptData(receiptSnapshot)
      setShowReceiptModal(true)
      setShowPaymentModal(false)

      // Success - reset cart
      setSuccess(true)
      show({ message: t('sale_completed'), variant: 'success' })
      setCart([])
      setDiscount(0)
      setPaymentStatus('PAID')
      setPaymentMethod('CASH')
      setCustomerId('')
      setAmountReceived('')
      setTimeout(() => {
        setSuccess(false)
      }, 2000)
      if (barcodeInputRef.current) {
        barcodeInputRef.current.focus()
      }
      router.refresh()
    } catch (err: any) {
      setError(err.message || t('error_occurred'))
      show({ title: 'Error', message: err.message || 'Failed to complete sale', variant: 'destructive' })
      console.error('Sale submission error:', err)
    } finally {
      setSubmitting(false)
    }
  }

  const subtotal = cart.reduce((sum, item) => sum + item.lineTotal, 0)
  const total = subtotal - discount
  const change =
    paymentStatus === 'PAID' && paymentMethod === 'CASH' && amountReceived
      ? parseFloat(amountReceived) - total
      : 0
  function handlePrintReceipt() {
    window.print()
  }

  function closeReceiptModal() {
    setShowReceiptModal(false)
    setReceiptData(null)
  }

  // Use cached search when offline, or filter products array when online
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([])

  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredProducts(products)
      return
    }

    async function performSearch() {
      if (!user?.currentShopId) return

      if (!isOnline) {
        // Offline: use IndexedDB search
        try {
          const results = await searchCachedProducts(user.currentShopId, searchTerm)
          setFilteredProducts(
            results.map((p) => ({
              id: p.id,
              name: p.name,
              barcode: p.barcode,
              unit: p.unit,
              price: p.price,
              trackStock: p.trackStock,
              cartonSize: p.cartonSize,
              cartonBarcode: p.cartonBarcode,
            }))
          )
        } catch (err) {
          console.error('Error searching cached products:', err)
          setFilteredProducts([])
        }
      } else {
        // Online: filter products array
        setFilteredProducts(
          products.filter(
            (p) =>
              p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
              (p.barcode && p.barcode.includes(searchTerm))
          )
        )
      }
    }

    performSearch()
  }, [searchTerm, products, user?.currentShopId, isOnline])

  if (!user?.currentShopId) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">{t('pos')}</h1>
        <p className="text-gray-600">Please select a shop first</p>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-[hsl(var(--background))]" dir={language === 'ur' ? 'rtl' : 'ltr'}>
      {/* Offline Banner */}
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 bg-yellow-500 text-white text-center py-2 z-50">
          <div className="flex items-center justify-center gap-2">
            <span>⚠️</span>
            <span className="font-semibold">{t('offline_mode')}</span>
          </div>
        </div>
      )}

      {/* Left Panel - Product Selection */}
      <div className="w-1/2 border-r border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-y-auto">
        <div className={`p-4 sticky top-0 bg-[hsl(var(--card))] border-b border-[hsl(var(--border))] z-10 ${!isOnline ? 'mt-8' : ''}`}>
          <h1 className="text-2xl font-bold mb-4">{t('pos')}</h1>

          {/* Barcode Input */}
          <form onSubmit={handleBarcodeSubmit} className="mb-4">
            <Input
              ref={barcodeInputRef}
              placeholder={t('scan_barcode')}
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              className="w-full text-lg h-11"
              autoFocus
            />
          </form>

          {/* Product Search */}
          <div className="relative mb-4">
            <Input
              ref={searchInputRef}
              placeholder={t('search_products')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full"
            />
            {searchTerm && filteredProducts.length > 0 && (
              <div className="absolute z-20 w-full mt-1 bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {filteredProducts.slice(0, 10).map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => handleProductSearch(product)}
                    className="w-full px-4 py-2 text-left hover:bg-[hsl(var(--muted))] flex justify-between items-center"
                  >
                    <div>
                      <div className="font-medium">{product.name}</div>
                      <div className="text-sm text-[hsl(var(--muted-foreground))]">
                        {product.barcode || 'No barcode'} • {product.unit}
                        {product.cartonSize ? ` • Carton: ${product.cartonSize}` : ''}
                      </div>
                    </div>
                    <div className="font-semibold">Rs.{product.price.toFixed(2)}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Error/Success Messages */}
          {error && (
            <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 p-3 bg-green-100 text-green-700 rounded">
              {t('sale_completed')}
            </div>
          )}
        </div>

        {/* Product Grid */}
        <div className="p-4">
          {loading ? (
            <div className="text-center py-8">Loading products...</div>
          ) : products.length === 0 ? (
            <div className="text-center py-8 text-[hsl(var(--muted-foreground))]">
              No products available
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {products.map((product) => (
                <button
                  key={product.id}
                  onClick={() => addToCart(product, 1)}
                  className="p-3 border border-[hsl(var(--border))] rounded-lg hover:bg-[hsl(var(--muted))] text-left"
                >
                  <div className="font-medium">{product.name}</div>
                  <div className="text-sm text-[hsl(var(--muted-foreground))]">{product.unit}</div>
                  <div className="font-semibold mt-1">Rs.{product.price.toFixed(2)}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Cart */}
      <div className="w-1/2 bg-[hsl(var(--card))] overflow-y-auto">
        <div className="p-4 sticky top-0 bg-[hsl(var(--card))] border-b border-[hsl(var(--border))] z-10">
          <h2 className="text-xl font-bold mb-4">{t('cart')}</h2>
        </div>

        <div className="p-4">
          {cart.length === 0 ? (
            <div className="text-center py-8 text-gray-600">Cart is empty</div>
          ) : (
            <div className="space-y-2">
              {cart.map((item) => (
                <div
                  key={item.product.id}
                  className="flex items-center justify-between p-3 border border-[hsl(var(--border))] rounded-lg"
                >
                  <div className="flex-1 cursor-pointer" onClick={() => setEditingItem(item)}>
                    <div className="font-medium">{item.product.name}</div>
                    <div className="text-sm text-[hsl(var(--muted-foreground))]">
                      Rs.{item.unitPrice.toFixed(2)} × {item.quantity} {item.product.unit}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => updateCartQuantity(item.product.id, item.quantity - 1)}
                      variant="outline"
                      className="w-8 h-8 p-0"
                    >
                      −
                    </Button>
                    <Input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => updateCartQuantity(item.product.id, parseFloat(e.target.value) || 0)}
                      className="w-16 text-center p-1 h-8"
                      step="0.001"
                    />
                    <Button
                      onClick={() => updateCartQuantity(item.product.id, item.quantity + 1)}
                      variant="outline"
                      className="w-8 h-8 p-0"
                    >
                      +
                    </Button>
                    <div className="w-24 text-right font-semibold">
                      Rs.{item.lineTotal.toFixed(2)}
                    </div>
                    <Button
                      onClick={() => removeFromCart(item.product.id)}
                      variant="outline"
                      className="ml-2"
                    >
                      ×
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Totals */}
        {cart.length > 0 && (
          <div className="p-4 border-t border-[hsl(var(--border))]">
            <div className="space-y-2 mb-4">
              <div className="flex justify-between">
                <span>{t('subtotal')}:</span>
                <span>Rs.{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>{t('discount')}:</span>
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  max={subtotal}
                  value={discount}
                  onChange={(e) => setDiscount(Math.max(0, Math.min(subtotal, parseFloat(e.target.value as any) || 0)))}
                  className="w-24 text-right"
                />
              </div>
              <div className="flex justify-between font-bold text-lg border-t pt-2">
                <span>{t('total')}:</span>
                <span>Rs.{total.toFixed(2)}</span>
              </div>
            </div>

            <Button onClick={handleCompleteSale} className="w-full h-12 text-lg font-semibold">
              {t('complete_sale')}
            </Button>
          </div>
        )}
      </div>

      {/* Edit Item Modal */}
      {editingItem && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-[hsl(var(--card))] rounded-lg p-6 w-full max-w-sm border border-[hsl(var(--border))]">
            <h2 className="text-xl font-bold mb-4">{t('edit')} {t('item')}</h2>
            <div className="mb-4 font-medium">{editingItem.product.name}</div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">{t('qty')}</label>
                <Input
                  type="number"
                  value={editForm.quantity}
                  onChange={(e) => setEditForm({ ...editForm, quantity: parseFloat(e.target.value) || 0 })}
                  className="w-full"
                  step="0.001"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('price')}</label>
                <Input
                  type="number"
                  value={editForm.price}
                  onChange={(e) => setEditForm({ ...editForm, price: parseFloat(e.target.value) || 0 })}
                  className="w-full"
                  step="0.01"
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setEditingItem(null)}
                  className="flex-1"
                >
                  {t('cancel')}
                </Button>
                <Button
                  onClick={saveEditedItem}
                  className="flex-1"
                >
                  {t('save')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-[hsl(var(--card))] rounded-lg p-6 w-full max-w-md border border-[hsl(var(--border))]">
            <h2 className="text-xl font-bold mb-4">{t('complete_sale')}</h2>

            {error && (
              <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  {t('payment_status')} <span className="text-red-500">*</span>
                </label>
                <select
                  value={paymentStatus}
                  onChange={(e) => {
                    setPaymentStatus(e.target.value as 'PAID' | 'UDHAAR')
                    if (e.target.value === 'PAID') {
                      setCustomerId('')
                    }
                  }}
                  className="input"
                >
                  <option value="PAID">{t('paid')}</option>
                  <option value="UDHAAR">{t('udhaar')}</option>
                </select>
              </div>

              {paymentStatus === 'UDHAAR' && (
                <div>
                  <label className="block text-sm font-medium mb-1">
                    {t('customers')} <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                    required
                    className="input"
                  >
                    <option value="">Select customer</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name} {customer.phone && `(${customer.phone})`}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {paymentStatus === 'PAID' && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      {t('payment_method')} <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value as 'CASH' | 'CARD' | 'OTHER')}
                      className="input"
                    >
                      <option value="CASH">{t('cash')}</option>
                      <option value="CARD">{t('card')}</option>
                      <option value="OTHER">{t('other')}</option>
                    </select>
                  </div>

                  {paymentMethod === 'CASH' && (
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        {t('amount_received')} <span className="text-red-500">*</span>
                      </label>
                      <Input
                        type="number"
                        step="0.01"
                        min={total}
                        value={amountReceived}
                        onChange={(e) => setAmountReceived(e.target.value)}
                        required
                        className="w-full"
                        autoFocus
                      />
                      {change > 0 && (
                        <div className="mt-1 text-sm text-green-600">
                          {t('change')}: Rs.{change.toFixed(2)}
                        </div>
                      )}
                      {change < 0 && (
                        <div className="mt-1 text-sm text-red-600">
                          Amount insufficient
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              <div className="pt-2 border-t border-[hsl(var(--border))]">
                <div className="flex justify-between font-bold text-lg mb-4">
                  <span>{t('total')}:</span>
                  <span>Rs.{total.toFixed(2)}</span>
                </div>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowPaymentModal(false)
                      setError('')
                    }}
                    className="flex-1"
                  >
                    {t('cancel')}
                  </Button>
                  <Button
                    onClick={submitSale}
                    disabled={submitting || (paymentStatus === 'PAID' && paymentMethod === 'CASH' && change < 0)}
                    className="flex-1"
                  >
                    {submitting ? t('processing') : t('confirm')}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {showReceiptModal && receiptData && (
        <>
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-[hsl(var(--card))] rounded-lg p-6 w-full max-w-md border border-[hsl(var(--border))]">
              <h2 className="text-xl font-bold mb-4">Receipt</h2>
              <div id="pos-print-receipt" className="bg-white border rounded p-4 text-sm">
                <div className="text-center mb-3">
                  <div className="font-semibold">{receiptData.shopName}</div>
                  {receiptData.shopCity && <div className="text-xs text-gray-500">{receiptData.shopCity}</div>}
                  <div className="text-xs text-gray-500">
                    {new Date(receiptData.timestamp).toLocaleString()}
                  </div>
                </div>
                <div className="text-xs mb-3">
                  <div>Invoice: {receiptData.id.slice(0, 8)}</div>
                  {receiptData.customerName && <div>Customer: {receiptData.customerName}</div>}
                </div>
                <table className="w-full text-xs mb-3">
                  <thead>
                    <tr className="border-t border-b">
                      <th className="text-left py-1">Item</th>
                      <th className="text-right py-1">Qty</th>
                      <th className="text-right py-1">Rate</th>
                      <th className="text-right py-1">Amt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {receiptData.items.map((item, idx) => (
                      <tr key={`${item.name}-${idx}`}>
                        <td className="pr-1">{item.name}</td>
                        <td className="text-right">
                          {item.quantity} {item.unit || ''}
                        </td>
                        <td className="text-right">{item.unitPrice.toFixed(2)}</td>
                        <td className="text-right">{item.lineTotal.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="text-xs space-y-1">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>Rs {receiptData.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Discount</span>
                    <span>Rs {receiptData.discount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-semibold border-t pt-1 mt-1">
                    <span>Total</span>
                    <span>Rs {receiptData.total.toFixed(2)}</span>
                  </div>
                  {receiptData.paymentStatus === 'PAID' && (
                    <div className="flex justify-between">
                      <span>Payment</span>
                      <span>{receiptData.paymentMethod || ''}</span>
                    </div>
                  )}
                  {typeof receiptData.amountReceived === 'number' && (
                    <div className="flex justify-between">
                      <span>Received</span>
                      <span>Rs {receiptData.amountReceived.toFixed(2)}</span>
                    </div>
                  )}
                  {typeof receiptData.change === 'number' && receiptData.change > 0 && (
                    <div className="flex justify-between">
                      <span>Change</span>
                      <span>Rs {receiptData.change.toFixed(2)}</span>
                    </div>
                  )}
                  {receiptData.paymentStatus === 'UDHAAR' && (
                    <div className="text-right text-yellow-600 font-semibold">UDHAAR</div>
                  )}
                </div>
                <div className="mt-3 text-center text-xs">Shukriya! Visit again.</div>
              </div>
              <div className="flex gap-2 mt-4">
                <Button variant="outline" className="flex-1" onClick={closeReceiptModal}>
                  Close
                </Button>
                <Button className="flex-1" onClick={handlePrintReceipt}>
                  Print
                </Button>
              </div>
            </div>
          </div>
          <style jsx global>{`
            @media print {
              body * {
                visibility: hidden;
              }
              #pos-print-receipt,
              #pos-print-receipt * {
                visibility: visible;
              }
              #pos-print-receipt {
                position: absolute;
                left: 0;
                right: 0;
                margin: 0 auto;
                width: 80mm;
                top: 0;
              }
            }
          `}</style>
        </>
      )}
    </div>
  )
}