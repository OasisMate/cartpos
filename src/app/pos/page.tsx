'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'

interface Product {
  id: string
  name: string
  barcode: string | null
  unit: string
  price: number
  trackStock: boolean
}

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
  const router = useRouter()
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

  useEffect(() => {
    if (user?.currentShopId) {
      fetchProducts()
      fetchCustomers()
    }
  }, [user?.currentShopId])

  useEffect(() => {
    // Focus barcode input on mount
    if (barcodeInputRef.current) {
      barcodeInputRef.current.focus()
    }
  }, [])

  async function fetchProducts() {
    try {
      setLoading(true)
      const response = await fetch('/api/products/pos')
      if (response.ok) {
        const data = await response.json()
        setProducts(data.products || [])
      }
    } catch (err) {
      console.error('Failed to fetch products:', err)
    } finally {
      setLoading(false)
    }
  }

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

  function handleBarcodeSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!barcodeInput.trim()) return

    const product = products.find((p) => p.barcode === barcodeInput.trim())
    if (product) {
      addToCart(product, 1)
    } else {
      setError('Product not found with this barcode')
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
      const subtotal = cart.reduce((sum, item) => sum + item.lineTotal, 0)
      const total = subtotal - discount

      const payload = {
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
        amountReceived: paymentStatus === 'PAID' && paymentMethod === 'CASH' && amountReceived
          ? parseFloat(amountReceived)
          : undefined,
      }

      const response = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to complete sale')
        setSubmitting(false)
        return
      }

      // Success - reset cart
      setSuccess(true)
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
    } catch (err) {
      setError('An error occurred. Please try again.')
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

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.barcode && p.barcode.includes(searchTerm))
  )

  if (!user?.currentShopId) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">POS</h1>
        <p className="text-gray-600">Please select a shop first</p>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Left Panel - Product Selection */}
      <div className="w-1/2 border-r bg-white overflow-y-auto">
        <div className="p-4 sticky top-0 bg-white border-b z-10">
          <h1 className="text-2xl font-bold mb-4">POS</h1>

          {/* Barcode Input */}
          <form onSubmit={handleBarcodeSubmit} className="mb-4">
            <input
              ref={barcodeInputRef}
              type="text"
              placeholder="Scan barcode or enter code..."
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
              autoFocus
            />
          </form>

          {/* Product Search */}
          <div className="relative mb-4">
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {searchTerm && filteredProducts.length > 0 && (
              <div className="absolute z-20 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {filteredProducts.slice(0, 10).map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => handleProductSearch(product)}
                    className="w-full px-4 py-2 text-left hover:bg-gray-100 flex justify-between items-center"
                  >
                    <div>
                      <div className="font-medium">{product.name}</div>
                      <div className="text-sm text-gray-500">
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
            <div className="text-center py-8 text-gray-600">
              No products available
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {products.map((product) => (
                <button
                  key={product.id}
                  onClick={() => addToCart(product, 1)}
                  className="p-3 border rounded-lg hover:bg-gray-50 text-left"
                >
                  <div className="font-medium">{product.name}</div>
                  <div className="text-sm text-gray-500">{product.unit}</div>
                  <div className="font-semibold mt-1">₹{product.price.toFixed(2)}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Cart */}
      <div className="w-1/2 bg-white overflow-y-auto">
        <div className="p-4 sticky top-0 bg-white border-b z-10">
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
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="font-medium">{item.product.name}</div>
                    <div className="text-sm text-gray-500">
                      ₹{item.unitPrice.toFixed(2)} × {item.quantity} {item.product.unit}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateCartQuantity(item.product.id, item.quantity - 1)}
                      className="w-8 h-8 border rounded hover:bg-gray-100"
                    >
                      −
                    </button>
                    <span className="w-12 text-center">{item.quantity}</span>
                    <button
                      onClick={() => updateCartQuantity(item.product.id, item.quantity + 1)}
                      className="w-8 h-8 border rounded hover:bg-gray-100"
                    >
                      +
                    </button>
                    <div className="w-24 text-right font-semibold">
                      ₹{item.lineTotal.toFixed(2)}
                    </div>
                    <button
                      onClick={() => removeFromCart(item.product.id)}
                      className="text-red-600 hover:underline ml-2"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Totals */}
        {cart.length > 0 && (
          <div className="p-4 border-t">
            <div className="space-y-2 mb-4">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>₹{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Discount:</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max={subtotal}
                  value={discount}
                  onChange={(e) => setDiscount(Math.max(0, Math.min(subtotal, parseFloat(e.target.value) || 0)))}
                  className="w-24 px-2 py-1 border rounded text-right"
                />
              </div>
              <div className="flex justify-between font-bold text-lg border-t pt-2">
                <span>Total:</span>
                <span>₹{total.toFixed(2)}</span>
              </div>
            </div>

            <button
              onClick={handleCompleteSale}
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold text-lg"
            >
              Complete Sale
            </button>
          </div>
        )}
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
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
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                      className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                      <input
                        type="number"
                        step="0.01"
                        min={total}
                        value={amountReceived}
                        onChange={(e) => setAmountReceived(e.target.value)}
                        required
                        className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
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

              <div className="pt-2 border-t">
                <div className="flex justify-between font-bold text-lg mb-4">
                  <span>Total:</span>
                  <span>₹{total.toFixed(2)}</span>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowPaymentModal(false)
                      setError('')
                    }}
                    className="flex-1 px-4 py-2 border rounded hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={submitSale}
                    disabled={submitting || (paymentStatus === 'PAID' && paymentMethod === 'CASH' && change < 0)}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    {submitting ? 'Processing...' : 'Confirm'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}