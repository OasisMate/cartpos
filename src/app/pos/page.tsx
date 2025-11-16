'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { getProductsWithCache, findProductByBarcode, searchCachedProducts, Product } from '@/lib/offline/products'
import { saveSale, syncPendingSalesBatch } from '@/lib/offline/sales'
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

export default function POSPage() {
  const { user } = useAuth()
  const { show } = useToast()
  const router = useRouter()
  const isOnline = useOnlineStatus()
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
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const barcodeInputRef = useRef<HTMLInputElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true)
      if (!user?.currentShopId) return

      // Use cache-aware product fetching
      const productsList = await getProductsWithCache(user.currentShopId, isOnline)
      setProducts(productsList)
    } catch (err) {
      console.error('Failed to fetch products:', err)
    } finally {
      setLoading(false)
    }
  }, [user?.currentShopId, isOnline])

  useEffect(() => {
    if (user?.currentShopId) {
      fetchProducts()
      fetchCustomers()
    }
  }, [user?.currentShopId, fetchProducts])

  // Per-page sync removed; handled by global background sync orchestrator

  // Sync pending sales when coming online
  useEffect(() => {
    if (isOnline && user?.currentShopId) {
      // Sync pending sales when going online
      syncPendingSalesBatch(user.currentShopId).catch((err) => {
        console.error('Error syncing pending sales:', err)
      })
    }
  }, [isOnline, user?.currentShopId])

  useEffect(() => {
    // Focus barcode input on mount
    if (barcodeInputRef.current) {
      barcodeInputRef.current.focus()
    }
  }, [])

  async function fetchCustomers() {
    try {
      const response = await fetch('/api/customers?limit=1000')
      if (response.ok) {
        const data = await response.json()
        setCustomers(data.customers || [])
      }
    } catch (err) {
      console.error('Failed to fetch customers:', err)
    }
  }

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

  async function handleBarcodeSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!barcodeInput.trim() || !user?.currentShopId) return

    try {
      // Try to find product by barcode in cache
      const product = await findProductByBarcode(user.currentShopId, barcodeInput.trim())
      if (product) {
        addToCart(
          {
            id: product.id,
            name: product.name,
            barcode: product.barcode,
            unit: product.unit,
            price: product.price,
            trackStock: product.trackStock,
          },
          1
        )
      } else {
        // Fallback to products array search
        const foundProduct = products.find((p) => p.barcode === barcodeInput.trim())
        if (foundProduct) {
          addToCart(foundProduct, 1)
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

    if (paymentStatus === 'PAID' && paymentMethod === 'CASH' && !amountReceived) {
      setError('Please enter amount received')
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

      // Success - reset cart
      setSuccess(true)
      show({ message: 'Sale saved locally', variant: 'success' })
      setTimeout(() => {
        setCart([])
        setDiscount(0)
        setPaymentStatus('PAID')
        setPaymentMethod('CASH')
        setCustomerId('')
        setAmountReceived('')
        setShowPaymentModal(false)
        setSuccess(false)
        if (barcodeInputRef.current) {
          barcodeInputRef.current.focus()
        }
        router.refresh()
      }, 2000)
    } catch (err: any) {
      setError(err.message || 'An error occurred. Please try again.')
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
        <h1 className="text-2xl font-bold mb-4">POS</h1>
        <p className="text-gray-600">Please select a shop first</p>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-[hsl(var(--background))]">
      {/* Offline Banner */}
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 bg-yellow-500 text-white text-center py-2 z-50">
          <div className="flex items-center justify-center gap-2">
            <span>⚠️</span>
            <span className="font-semibold">You are offline. Some features may be limited.</span>
          </div>
        </div>
      )}

      {/* Left Panel - Product Selection */}
      <div className="w-1/2 border-r border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-y-auto">
        <div className={`p-4 sticky top-0 bg-[hsl(var(--card))] border-b border-[hsl(var(--border))] z-10 ${!isOnline ? 'mt-8' : ''}`}>
          <h1 className="text-2xl font-bold mb-4">POS</h1>

          {/* Barcode Input */}
          <form onSubmit={handleBarcodeSubmit} className="mb-4">
            <Input
              ref={barcodeInputRef}
              placeholder="Scan barcode or enter code..."
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
              placeholder="Search products..."
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
                      </div>
                    </div>
                    <div className="font-semibold">₹{product.price.toFixed(2)}</div>
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
              Sale completed successfully!
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
                  <div className="font-semibold mt-1">₹{product.price.toFixed(2)}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Cart */}
      <div className="w-1/2 bg-[hsl(var(--card))] overflow-y-auto">
        <div className="p-4 sticky top-0 bg-[hsl(var(--card))] border-b border-[hsl(var(--border))] z-10">
          <h2 className="text-xl font-bold mb-4">Cart</h2>
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
                  <div className="flex-1">
                    <div className="font-medium">{item.product.name}</div>
                    <div className="text-sm text-[hsl(var(--muted-foreground))]">
                      ₹{item.unitPrice.toFixed(2)} × {item.quantity} {item.product.unit}
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
                    <span className="w-12 text-center">{item.quantity}</span>
                    <Button
                      onClick={() => updateCartQuantity(item.product.id, item.quantity + 1)}
                      variant="outline"
                      className="w-8 h-8 p-0"
                    >
                      +
                    </Button>
                    <div className="w-24 text-right font-semibold">
                      ₹{item.lineTotal.toFixed(2)}
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
                <span>Subtotal:</span>
                <span>₹{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Discount:</span>
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
                <span>Total:</span>
                <span>₹{total.toFixed(2)}</span>
              </div>
            </div>

            <Button onClick={handleCompleteSale} className="w-full h-12 text-lg font-semibold">
              Complete Sale
            </Button>
          </div>
        )}
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-[hsl(var(--card))] rounded-lg p-6 w-full max-w-md border border-[hsl(var(--border))]">
            <h2 className="text-xl font-bold mb-4">Complete Payment</h2>

            {error && (
              <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Payment Status <span className="text-red-500">*</span>
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
                  <option value="PAID">Paid</option>
                  <option value="UDHAAR">Udhaar (Credit)</option>
                </select>
              </div>

              {paymentStatus === 'UDHAAR' && (
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Customer <span className="text-red-500">*</span>
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
                      Payment Method <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value as 'CASH' | 'CARD' | 'OTHER')}
                      className="input"
                    >
                      <option value="CASH">Cash</option>
                      <option value="CARD">Card</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>

                  {paymentMethod === 'CASH' && (
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Amount Received <span className="text-red-500">*</span>
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
                          Change: ₹{change.toFixed(2)}
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
                  <span>Total:</span>
                  <span>₹{total.toFixed(2)}</span>
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
                    Cancel
                  </Button>
                  <Button
                    onClick={submitSale}
                    disabled={submitting || (paymentStatus === 'PAID' && paymentMethod === 'CASH' && change < 0)}
                    className="flex-1"
                  >
                    {submitting ? 'Processing...' : 'Confirm'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}