'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { useLanguage } from '@/contexts/LanguageContext'
import { getProductsWithCache, getCachedProducts, findProductByBarcode, searchCachedProducts, Product } from '@/lib/offline/products'
import { saveSale } from '@/lib/offline/sales'
import { getCustomers, saveCustomers, saveProducts } from '@/lib/offline/indexedDb'
import { cuid } from '@/lib/utils/cuid'
import { sumCartLines, calculateTotals, formatNumber, formatCurrency, roundToTwo } from '@/lib/utils/money'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import { useToast } from '@/components/ui/ToastProvider'
import { Minus, Plus, X, ShoppingCart, Package, Trash2, Edit3 } from 'lucide-react'
import ReceiptModal from '@/components/receipt/ReceiptModal'

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
  isCarton?: boolean  // true if selling by carton, false if by piece
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
  invoiceNumber: string
  timestamp: string
  shopName: string
  shopCity?: string | null
  shopPhone?: string | null
  shopAddressLine1?: string | null
  shopAddressLine2?: string | null
  shopLogoUrl?: string | null
  receiptHeaderDisplay?: 'NAME_ONLY' | 'LOGO_ONLY' | 'BOTH'
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
  const [discount, setDiscount] = useState(0)
  const [quickAddProduct, setQuickAddProduct] = useState<Product | null>(null)
  const [quickAddQuantity, setQuickAddQuantity] = useState('1')
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
  const [productStock, setProductStock] = useState<Record<string, number>>({})
  const [allowNegativeStock, setAllowNegativeStock] = useState<boolean>(true) // Default: allow
  const [shopSettings, setShopSettings] = useState<{
    logoUrl?: string | null
    receiptHeaderDisplay?: 'NAME_ONLY' | 'LOGO_ONLY' | 'BOTH'
    cardFeePercent?: number | null
    allowCardFeeOverride?: boolean
  } | null>(null)

  // Edit Item State
  const [editingItem, setEditingItem] = useState<CartItem | null>(null)
  const [editForm, setEditForm] = useState({ quantity: 0, price: 0 })
  const [cardFeePercentOverride, setCardFeePercentOverride] = useState<number | null>(null)

  // Held sales (parked carts)
  interface HeldSale {
    id: string
    createdAt: string
    note: string
    cart: CartItem[]
    discount: number
    paymentStatus: 'PAID' | 'UDHAAR'
    paymentMethod: 'CASH' | 'CARD' | 'OTHER'
    customerId: string
  }
  const [heldSales, setHeldSales] = useState<HeldSale[]>([])
  const [showHeldSalesModal, setShowHeldSalesModal] = useState(false)
  const [showHoldNoteModal, setShowHoldNoteModal] = useState(false)
  const [holdNoteDraft, setHoldNoteDraft] = useState('')
  const [showNewCustomerModal, setShowNewCustomerModal] = useState(false)
  const [newCustomerForm, setNewCustomerForm] = useState({ name: '', phone: '', notes: '', openingBalance: '' })
  const cartScrollRef = useRef<HTMLDivElement | null>(null)
  const [creatingCustomer, setCreatingCustomer] = useState(false)
  const [unfoundBarcode, setUnfoundBarcode] = useState<string | null>(null)
  const [showQuickAddProductModal, setShowQuickAddProductModal] = useState(false)
  const [quickAddProductForm, setQuickAddProductForm] = useState({ name: '', barcode: '', price: '', unit: 'pcs' })
  const [creatingProduct, setCreatingProduct] = useState(false)

  const canManageProducts =
    user?.role === 'PLATFORM_ADMIN' ||
    (user?.shops?.some(
      (s: { shopId: string; shopRole: string }) =>
        s.shopId === user?.currentShopId && s.shopRole === 'STORE_MANAGER'
    ) ?? false)

  const barcodeInputRef = useRef<HTMLInputElement>(null)

  // Fast lookup maps for barcode -> product
  const [productIndex, setProductIndex] = useState<{
    byBarcode: Record<string, Product>
    byCartonBarcode: Record<string, Product>
  }>({ byBarcode: {}, byCartonBarcode: {} })

  // Load POS data: cache-first, then background refresh from API
  useEffect(() => {
    async function loadPOSData() {
      if (!user?.currentShopId) return
      
      const shopId = user.currentShopId // Store for use in async functions
      
      try {
        setLoading(true)

        // 1) Load from local cache first (fast path)
        let hasLocalData = false

        const cachedProducts = await getCachedProducts(shopId)
        if (cachedProducts.length > 0) {
          const sortedProducts = cachedProducts
            .map((p) => ({
              id: p.id,
              name: p.name,
              barcode: p.barcode,
              unit: p.unit,
              price: p.price,
              cartonPrice: p.cartonPrice,
              trackStock: p.trackStock,
              cartonSize: p.cartonSize,
              cartonBarcode: p.cartonBarcode,
            }))
            .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
          setProducts(sortedProducts)
          hasLocalData = true
        }

        const cachedCustomers = await getCustomers(shopId)
        if (cachedCustomers.length > 0) {
          setCustomers(cachedCustomers.map((c) => ({ id: c.id, name: c.name, phone: c.phone })))
          hasLocalData = true
        }

        // If offline or we already have local data, UI can render without waiting for network
        if (!isOnline || hasLocalData) {
          setLoading(false)
        }

        if (!isOnline) {
          // Offline: nothing more to do
          return
        }

        // 2) Online: refresh from server in background and update cache
        try {
          const response = await fetch('/api/pos/init')
          if (response.ok) {
            const data = await response.json()

            // Products
            const sortedProducts = [...(data.products || [])].sort((a: Product, b: Product) =>
              a.name.toLowerCase().localeCompare(b.name.toLowerCase())
            )
            setProducts(sortedProducts)
            await saveProducts(shopId, sortedProducts)

            // Stock
            setProductStock(data.stock || {})

            // Customers
            const customers = (data.customers || []).map((c: any) => ({
              id: c.id,
              name: c.name,
              phone: c.phone,
            }))
            setCustomers(customers)
            await saveCustomers(shopId, customers)

            // Settings
            if (data.settings?.allowNegativeStock !== undefined) {
              setAllowNegativeStock(data.settings.allowNegativeStock)
            }
              setShopSettings({
                logoUrl: data.settings?.logoUrl || null,
                receiptHeaderDisplay: data.settings?.receiptHeaderDisplay || 'NAME_ONLY',
                cardFeePercent: typeof data.settings?.cardFeePercent === 'number'
                  ? data.settings.cardFeePercent
                  : data.settings?.cardFeePercent
                  ? Number(data.settings.cardFeePercent)
                  : 0,
                allowCardFeeOverride: Boolean(data.settings?.allowCardFeeOverride || false),
              })
          } else {
            throw new Error('Init endpoint failed')
          }
        } catch (err) {
          console.warn('Failed to refresh POS data from init endpoint, falling back to individual calls:', err)

          const productsList = await getProductsWithCache(shopId, isOnline)
          const sortedProducts = [...productsList].sort((a, b) =>
            a.name.toLowerCase().localeCompare(b.name.toLowerCase())
          )
          setProducts(sortedProducts)

          const cached = await getCustomers(shopId)
          if (cached.length > 0) {
            setCustomers(cached.map((c) => ({ id: c.id, name: c.name, phone: c.phone })))
          } else {
            const response = await fetch('/api/customers?limit=1000')
            if (response.ok) {
              const data = await response.json()
              const customers = data.customers || []
              setCustomers(customers)
              await saveCustomers(shopId, customers)
            }
          }

          const stockResponse = await fetch('/api/stock')
          if (stockResponse.ok) {
            const stockData = await stockResponse.json()
            const stockMap: Record<string, number> = {}
            if (stockData.stock && Array.isArray(stockData.stock)) {
              stockData.stock.forEach((item: { productId: string; stock: number }) => {
                stockMap[item.productId] = item.stock
              })
            }
            setProductStock(stockMap)
          }

          const settingsResponse = await fetch('/api/shop/settings')
          if (settingsResponse.ok) {
            const settingsData = await settingsResponse.json()
            if (settingsData.settings?.allowNegativeStock !== undefined) {
              setAllowNegativeStock(settingsData.settings.allowNegativeStock)
            }
            setShopSettings({
              logoUrl: settingsData.settings?.logoUrl || null,
              receiptHeaderDisplay: settingsData.settings?.receiptHeaderDisplay || 'NAME_ONLY',
              cardFeePercent: typeof settingsData.settings?.cardFeePercent === 'number'
                ? settingsData.settings.cardFeePercent
                : settingsData.settings?.cardFeePercent
                ? Number(settingsData.settings.cardFeePercent)
                : 0,
              allowCardFeeOverride: Boolean(settingsData.settings?.allowCardFeeOverride || false),
            })
          }
        }
      } catch (err) {
        console.error('Failed to load POS data:', err)
      } finally {
        // Ensure loading is turned off after the first load (when there was no cache)
        setLoading(false)
      }
    }

    if (user?.currentShopId) {
      loadPOSData()
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

  // Refresh products and stock when page regains focus (debounced to prevent excessive calls)
  useEffect(() => {
    let debounceTimer: NodeJS.Timeout | null = null
    
    async function refreshData() {
      if (!user?.currentShopId || !isOnline) return
      
      const shopId = user.currentShopId // Store for use in setTimeout
      
      // Debounce: only refresh if 5 seconds have passed since last focus
      if (debounceTimer) {
        clearTimeout(debounceTimer)
      }
      
      debounceTimer = setTimeout(async () => {
        try {
          // Use optimized endpoint for refresh
          const response = await fetch('/api/pos/init')
          if (response.ok) {
            const data = await response.json()
            
            // Update products
            const sortedProducts = [...(data.products || [])].sort((a: Product, b: Product) => 
              a.name.toLowerCase().localeCompare(b.name.toLowerCase())
            )
            setProducts(sortedProducts)
            await saveProducts(shopId, sortedProducts)
            
            // Update stock
            setProductStock(data.stock || {})
            
            // Update customers
            const customers = (data.customers || []).map((c: any) => ({ 
              id: c.id, 
              name: c.name, 
              phone: c.phone 
            }))
            setCustomers(customers)
            await saveCustomers(shopId, customers)
            
            // Update shop settings for receipt
            if (data.settings) {
              setShopSettings({
                logoUrl: data.settings.logoUrl || null,
                receiptHeaderDisplay: data.settings.receiptHeaderDisplay || 'NAME_ONLY',
              })
            }
          }
        } catch (err) {
          console.error('Failed to refresh POS data:', err)
        }
      }, 5000) // 5 second debounce
    }

    function handleFocus() {
      refreshData()
    }

    window.addEventListener('focus', handleFocus)
    return () => {
      window.removeEventListener('focus', handleFocus)
      if (debounceTimer) {
        clearTimeout(debounceTimer)
      }
    }
  }, [user?.currentShopId, isOnline])

  // Load held sales for current user + shop from localStorage
  useEffect(() => {
    if (!user?.id || !user.currentShopId) return
    const key = `held_sales_${user.id}_${user.currentShopId}`
    try {
      const raw = localStorage.getItem(key)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) {
          setHeldSales(parsed)
        }
      }
    } catch (err) {
      console.error('Failed to load held sales from storage:', err)
    }
  }, [user?.id, user?.currentShopId])

  function persistHeldSales(next: HeldSale[]) {
    if (!user?.id || !user.currentShopId) return
    const key = `held_sales_${user.id}_${user.currentShopId}`
    try {
      localStorage.setItem(key, JSON.stringify(next))
    } catch (err) {
      console.error('Failed to save held sales to storage:', err)
    }
  }

  // Rebuild product lookup index whenever products list changes
  useEffect(() => {
    const byBarcode: Record<string, Product> = {}
    const byCartonBarcode: Record<string, Product> = {}

    products.forEach((p) => {
      if (p.barcode) {
        byBarcode[p.barcode.trim()] = p
      }
      if (p.cartonBarcode) {
        byCartonBarcode[p.cartonBarcode.trim()] = p
      }
    })

    setProductIndex({ byBarcode, byCartonBarcode })
  }, [products])

  async function addToCart(product: Product, quantity: number = 1, isCarton: boolean = false) {
    // Determine price based on carton vs piece
    const unitPrice = isCarton && product.cartonPrice 
      ? product.cartonPrice 
      : product.price
    
    // If adding carton, quantity should be in cartons, not pieces
    const finalQuantity = isCarton ? quantity : quantity

    // Check stock if product tracks stock (purely client-side, no per-product network calls)
    if (product.trackStock) {
      // If stock is unknown, treat as very high (no blocking) but still allow warnings when it becomes known
      let currentStock = productStock[product.id]
      if (currentStock === undefined || currentStock === null) {
        currentStock = Number.POSITIVE_INFINITY
      }

      // Calculate total quantity in cart (including what we're about to add)
      // Need to sum all items for this product (both pieces and cartons) and convert to pieces
      const cartonSize = product.cartonSize || 1
      const existingItem = cart.find((item) => 
        item.product.id === product.id && item.isCarton === isCarton
      )
      
      // Calculate total pieces already in cart for this product
      let totalPiecesInCart = 0
      cart.forEach((item) => {
        if (item.product.id === product.id) {
          if (item.isCarton) {
            totalPiecesInCart += item.quantity * cartonSize
          } else {
            totalPiecesInCart += item.quantity
          }
        }
      })
      
      // Add the quantity we're about to add
      const piecesToAdd = isCarton ? finalQuantity * cartonSize : finalQuantity
      const totalPiecesAfterAdd = totalPiecesInCart + piecesToAdd

      // Check if we exceed available stock (only if stock is finite)
      if (Number.isFinite(currentStock) && currentStock <= 0 && totalPiecesAfterAdd > 0) {
        if (!allowNegativeStock) {
          show({ 
            message: `Out of stock. Available: ${formatNumber(currentStock)} ${product.unit}`, 
            variant: 'destructive' 
          })
          return
        } else {
          // Warn but allow if shop setting allows negative stock
          show({ 
            message: `Warning: Stock is ${formatNumber(currentStock)}. Adding will create negative stock.`, 
            variant: 'warning' 
          })
        }
      } else if (Number.isFinite(currentStock) && currentStock < totalPiecesAfterAdd) {
        if (!allowNegativeStock) {
          show({ 
            message: `Insufficient stock. Available: ${formatNumber(currentStock)} ${product.unit}, Requested: ${formatNumber(totalPiecesAfterAdd)} ${product.unit}`, 
            variant: 'destructive' 
          })
          return
        } else {
          // Warn but allow
          show({ 
            message: `Warning: Stock will go negative. Available: ${formatNumber(currentStock)} ${product.unit}`, 
            variant: 'warning' 
          })
        }
      }
    }

    const existingItem = cart.find((item) => 
      item.product.id === product.id && item.isCarton === isCarton
    )

    if (existingItem) {
      setCart(
        cart.map((item) =>
          item.product.id === product.id && item.isCarton === isCarton
            ? {
                ...item,
                quantity: item.quantity + finalQuantity,
                lineTotal: (item.quantity + finalQuantity) * item.unitPrice,
              }
            : item
        )
      )
    } else {
      setCart([
        ...cart,
        {
          product,
          quantity: finalQuantity,
          unitPrice,
          lineTotal: unitPrice * finalQuantity,
          isCarton,
        },
      ])
    }

    // Clear input
    setBarcodeInput('')
    if (barcodeInputRef.current) {
      barcodeInputRef.current.focus()
    }
  }

  function removeFromCart(productId: string) {
    setCart(cart.filter((item) => item.product.id !== productId))
  }

  async function updateCartQuantity(productId: string, quantity: number) {
    if (quantity <= 0) {
      removeFromCart(productId)
      return
    }

    const cartItem = cart.find(item => item.product.id === productId)
    if (!cartItem) return

    // Check stock if product tracks stock (client-side only)
    if (cartItem.product.trackStock) {
      let currentStock = productStock[productId]
      if (currentStock === undefined || currentStock === null) {
        currentStock = Number.POSITIVE_INFINITY
      }

      // Calculate total pieces in cart for this product (including other items)
      const cartonSize = cartItem.product.cartonSize || 1
      let totalPiecesInCart = 0
      cart.forEach((item) => {
        if (item.product.id === productId) {
          if (item.isCarton) {
            totalPiecesInCart += item.quantity * cartonSize
          } else {
            totalPiecesInCart += item.quantity
          }
        }
      })
      
      // Remove the current item's quantity and add the new quantity
      const currentItemPieces = cartItem.isCarton 
        ? cartItem.quantity * cartonSize 
        : cartItem.quantity
      const newItemPieces = cartItem.isCarton 
        ? quantity * cartonSize 
        : quantity
      const totalPiecesAfterUpdate = totalPiecesInCart - currentItemPieces + newItemPieces

      // Check if we exceed available stock (only if stock is finite)
      if (Number.isFinite(currentStock) && currentStock < totalPiecesAfterUpdate) {
        if (!allowNegativeStock) {
          show({ 
            message: `Insufficient stock. Available: ${formatNumber(currentStock)} ${cartItem.product.unit}`, 
            variant: 'destructive' 
          })
          return
        } else {
          // Warn but allow
          show({ 
            message: `Warning: Stock will go negative. Available: ${formatNumber(currentStock)} ${cartItem.product.unit}`, 
            variant: 'warning' 
          })
        }
      }
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

    // Check if input contains quantity (format: "barcode x5" or "barcode*5")
    const input = barcodeInput.trim()
    const quantityMatch = input.match(/^(.+?)\s*[x*]\s*(\d+)$/i)
    const barcodeToSearch = quantityMatch ? quantityMatch[1].trim() : input
    const requestedQuantity = quantityMatch ? parseInt(quantityMatch[2]) : 1

    // FIRST: Try in-memory indexed maps (fastest - no async calls)
    let foundProduct =
      productIndex.byBarcode[barcodeToSearch] ||
      productIndex.byCartonBarcode[barcodeToSearch] ||
      products.find(
        (p) =>
          ((p as any).sku && (p as any).sku.toLowerCase() === barcodeToSearch.toLowerCase()) ||
          (p.name && p.name.toLowerCase() === barcodeToSearch.toLowerCase())
      )

    // If not found in memory, try IndexedDB (async but cached)
    if (!foundProduct) {
      try {
        const cachedProduct = await findProductByBarcode(user.currentShopId, barcodeToSearch)
        if (cachedProduct) {
          foundProduct = {
            id: cachedProduct.id,
            name: cachedProduct.name,
            barcode: cachedProduct.barcode,
            unit: cachedProduct.unit,
            price: cachedProduct.price,
            cartonPrice: cachedProduct.cartonPrice,
            trackStock: cachedProduct.trackStock,
            cartonSize: cachedProduct.cartonSize,
            cartonBarcode: cachedProduct.cartonBarcode,
          } as Product
        }
      } catch (err) {
        console.warn('IndexedDB lookup failed:', err)
      }
    }

    if (foundProduct) {
      setUnfoundBarcode(null)
      const isCartonMatch = foundProduct.cartonBarcode === barcodeToSearch
      const quantity = isCartonMatch ? (foundProduct.cartonSize || 1) : requestedQuantity
      const isCarton = isCartonMatch && !!foundProduct.cartonPrice

      addToCart(foundProduct, isCarton ? 1 : quantity, isCarton)

      if (isCartonMatch) {
        show({ message: `Added 1 carton (${quantity} ${foundProduct.unit})`, variant: 'success' })
      } else if (requestedQuantity > 1) {
        show({ message: `Added ${requestedQuantity} ${foundProduct.unit}`, variant: 'success' })
      }
    } else {
      const message = `Product not added. No match found for "${barcodeToSearch}".`
      setError(message)
      setUnfoundBarcode(barcodeToSearch)
      show({ message, variant: 'destructive' })
      if (barcodeInputRef.current) {
        barcodeInputRef.current.focus()
        barcodeInputRef.current.select()
      }
      setTimeout(() => setError(''), 4000)
    }

    // Clear barcode input after successful processing
    if (foundProduct) {
      setBarcodeInput('')
      if (barcodeInputRef.current) {
        barcodeInputRef.current.focus()
      }
    }
  }

  function handleProductSearch(product: Product) {
    // Show quick add modal for quantity input
    setQuickAddProduct(product)
    setQuickAddQuantity('1')
  }

  function handleQuickAdd() {
    if (!quickAddProduct) return
    
    const quantity = parseInt(quickAddQuantity) || 1
    if (quantity <= 0) {
      show({ message: 'Quantity must be greater than 0', variant: 'destructive' })
      return
    }

    addToCart(quickAddProduct, quantity, false)
    setQuickAddProduct(null)
    setQuickAddQuantity('1')
    if (barcodeInputRef.current) {
      barcodeInputRef.current.focus()
    }
  }

  async function handleQuickAddProductSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user?.currentShopId) return
    const name = quickAddProductForm.name.trim()
    const price = parseFloat(quickAddProductForm.price)
    if (!name || isNaN(price) || price <= 0) {
      show({ message: 'Name and price are required. Price must be > 0.', variant: 'destructive' })
      return
    }
    setCreatingProduct(true)
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.toUpperCase(),
          barcode: quickAddProductForm.barcode.trim() || undefined,
          unit: quickAddProductForm.unit || 'pcs',
          price,
          trackStock: false,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create product')
      const created = data.product as { id: string; name: string; barcode: string | null; unit: string; price: number; trackStock?: boolean }
      const newProduct: Product = {
        id: created.id,
        name: created.name,
        barcode: created.barcode,
        unit: created.unit,
        price: Number(created.price),
        trackStock: created.trackStock ?? false,
      }
      const shopId = user.currentShopId
      const list = await getProductsWithCache(shopId, true)
      const sorted = [...list].sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
      if (!sorted.some((p) => p.id === newProduct.id)) {
        sorted.push(newProduct)
        sorted.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
      }
      setProducts(sorted)
      await saveProducts(shopId, sorted)
      addToCart(newProduct, 1, false)
      setShowQuickAddProductModal(false)
      setUnfoundBarcode(null)
      setError('')
      setQuickAddProductForm({ name: '', barcode: '', price: '', unit: 'pcs' })
      setBarcodeInput('')
      show({ message: 'Product added and in cart', variant: 'success' })
      if (barcodeInputRef.current) barcodeInputRef.current.focus()
    } catch (err: any) {
      show({ message: err.message || 'Failed to add product', variant: 'destructive' })
    } finally {
      setCreatingProduct(false)
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

    // Initialize card fee percent override with shop default when opening modal
    const defaultCardFee = Number(shopSettings?.cardFeePercent ?? 0)
    setCardFeePercentOverride(defaultCardFee)

    setShowPaymentModal(true)
  }

  function handleHoldSale() {
    if (cart.length === 0) {
      setError('Cart is empty')
      return
    }

    // Open modal to capture optional note
    setHoldNoteDraft('')
    setShowHoldNoteModal(true)
  }

  function handleClearCart() {
    if (cart.length === 0) {
      return
    }
    setCart([])
    setDiscount(0)
    setPaymentStatus('PAID')
    setPaymentMethod('CASH')
    setCustomerId('')
    setAmountReceived('')
    setError('')
    if (barcodeInputRef.current) {
      barcodeInputRef.current.focus()
    }
  }

  useEffect(() => {
    if (!cartScrollRef.current) return
    if (cart.length === 0) return
    cartScrollRef.current.scrollTop = cartScrollRef.current.scrollHeight
  }, [cart.length])

  function confirmHoldSale() {
    if (cart.length === 0) {
      setShowHoldNoteModal(false)
      return
    }

    const holdId = cuid()
    const timestamp = new Date()
    const timeLabel = timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    const userNote = holdNoteDraft || ''
    const shortId = holdId.slice(-4).toUpperCase()
    const defaultLabel = `Hold ${timeLabel} (${shortId})`
    const note = userNote.trim() ? userNote.trim() : defaultLabel

    const held: HeldSale = {
      id: holdId,
      createdAt: timestamp.toISOString(),
      note,
      cart,
      discount,
      paymentStatus,
      paymentMethod,
      customerId,
    }

    const next = [...heldSales, held]
    setHeldSales(next)
    persistHeldSales(next)

    setShowHoldNoteModal(false)
    setHoldNoteDraft('')

    // Reset current sale so cashier can continue with next customer
    setCart([])
    setDiscount(0)
    setPaymentStatus('PAID')
    setPaymentMethod('CASH')
    setCustomerId('')
    setAmountReceived('')
    setError('')
    if (barcodeInputRef.current) {
      barcodeInputRef.current.focus()
    }
    show({ message: 'Sale held successfully', variant: 'success' })
  }

  function resumeHeldSale(held: HeldSale) {
    setCart(held.cart)
    setDiscount(held.discount)
    setPaymentStatus(held.paymentStatus)
    setPaymentMethod(held.paymentMethod)
    setCustomerId(held.customerId)
    setAmountReceived('')

    const remaining = heldSales.filter((h) => h.id !== held.id)
    setHeldSales(remaining)
    persistHeldSales(remaining)
    setShowHeldSalesModal(false)

    if (barcodeInputRef.current) {
      barcodeInputRef.current.focus()
    }
  }

  function removeHeldSale(id: string) {
    const remaining = heldSales.filter((h) => h.id !== id)
    setHeldSales(remaining)
    persistHeldSales(remaining)
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
      const { total: baseTotal } = calculateTotals(subtotal, discount)

      // Determine card fee for this sale (applied on total after discount)
      const effectiveCardFeePercent =
        paymentStatus === 'PAID' && paymentMethod === 'CARD'
          ? (shopSettings?.allowCardFeeOverride
              ? Number(cardFeePercentOverride ?? shopSettings?.cardFeePercent ?? 0)
              : Number(shopSettings?.cardFeePercent ?? 0))
          : 0

      const cardFee =
        effectiveCardFeePercent > 0
          ? roundToTwo((baseTotal * effectiveCardFeePercent) / 100)
          : 0

      const total = roundToTwo(baseTotal + cardFee)

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
      
      // Generate sequential invoice number (stored per shop in localStorage)
      const invoiceKey = `invoice_counter_${user.currentShopId}`
      const lastNum = parseInt(localStorage.getItem(invoiceKey) || '0', 10)
      const nextNum = lastNum + 1
      localStorage.setItem(invoiceKey, String(nextNum))
      const invoiceNumber = String(nextNum).padStart(6, '0')

      const receiptSnapshot: ReceiptData = {
        id: saleId,
        invoiceNumber,
        timestamp: new Date().toISOString(),
        shopName: shopInfo?.shop.name || 'CartPOS Shop',
        shopCity: shopInfo?.shop.city || '',
        shopPhone: shopInfo?.shop.phone || '',
        shopAddressLine1: (shopInfo?.shop as any)?.addressLine1 || null,
        shopAddressLine2: (shopInfo?.shop as any)?.addressLine2 || null,
        shopLogoUrl: shopSettings?.logoUrl || null,
        receiptHeaderDisplay: shopSettings?.receiptHeaderDisplay || 'NAME_ONLY',
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
    } catch (err: any) {
      setError(err.message || t('error_occurred'))
      show({ title: 'Error', message: err.message || 'Failed to complete sale', variant: 'destructive' })
      console.error('Sale submission error:', err)
    } finally {
      setSubmitting(false)
    }
  }

  const subtotal = cart.reduce((sum, item) => sum + item.lineTotal, 0)
  const baseTotal = subtotal - discount
  const effectiveCardFeePercentForDisplay =
    paymentStatus === 'PAID' && paymentMethod === 'CARD'
      ? (shopSettings?.allowCardFeeOverride
          ? Number(cardFeePercentOverride ?? shopSettings?.cardFeePercent ?? 0)
          : Number(shopSettings?.cardFeePercent ?? 0))
      : 0
  const cardFeeForDisplay =
    effectiveCardFeePercentForDisplay > 0
      ? roundToTwo((baseTotal * effectiveCardFeePercentForDisplay) / 100)
      : 0
  const total = roundToTwo(baseTotal + cardFeeForDisplay)
  const change =
    paymentStatus === 'PAID' && paymentMethod === 'CASH' && amountReceived
      ? parseFloat(amountReceived) - total
      : 0
  function closeReceiptModal() {
    setShowReceiptModal(false)
    setReceiptData(null)
  }

  // Convert ReceiptData to invoice format for ReceiptModal
  const receiptInvoice = receiptData ? {
    id: receiptData.id,
    number: receiptData.invoiceNumber,
    createdAt: receiptData.timestamp,
    shop: {
      name: receiptData.shopName,
      city: receiptData.shopCity,
      phone: receiptData.shopPhone,
      addressLine1: receiptData.shopAddressLine1,
      addressLine2: receiptData.shopAddressLine2,
      settings: {
        logoUrl: receiptData.shopLogoUrl,
        receiptHeaderDisplay: receiptData.receiptHeaderDisplay,
      },
    },
    lines: receiptData.items.map((item, idx) => ({
      id: `line-${idx}`,
      product: { name: item.name },
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
    })),
    subtotal: receiptData.subtotal,
    discount: receiptData.discount,
    total: receiptData.total,
    paymentStatus: receiptData.paymentStatus,
    paymentMethod: receiptData.paymentMethod,
    payments: receiptData.amountReceived ? [{ amount: receiptData.amountReceived }] : undefined,
    customerName: receiptData.customerName,
  } : null

  // Use cached search when offline, or filter products array when online
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([])

  useEffect(() => {
    if (!barcodeInput.trim()) {
      setFilteredProducts(products)
      return
    }

    async function performSearch() {
      if (!user?.currentShopId) return

      if (!isOnline) {
        // Offline: use IndexedDB search
        try {
          const results = await searchCachedProducts(user.currentShopId, barcodeInput)
          const mapped = results.map((p) => ({
            id: p.id,
            name: p.name,
            barcode: p.barcode,
            unit: p.unit,
            price: p.price,
            trackStock: p.trackStock,
            cartonSize: p.cartonSize,
            cartonBarcode: p.cartonBarcode,
          }))
          // Sort: first by name alphabetically, then by price (ascending) for same names
          mapped.sort((a, b) => {
            const nameCompare = a.name.toLowerCase().localeCompare(b.name.toLowerCase())
            if (nameCompare !== 0) return nameCompare
            return parseFloat(a.price.toString()) - parseFloat(b.price.toString())
          })
          setFilteredProducts(mapped)
        } catch (err) {
          console.error('Error searching cached products:', err)
          setFilteredProducts([])
        }
      } else {
        // Online: filter products array
        const filtered = products.filter(
          (p) =>
            p.name.toLowerCase().includes(barcodeInput.toLowerCase()) ||
            (p.barcode && p.barcode.includes(barcodeInput))
        )
        // Sort: first by name alphabetically, then by price (ascending) for same names
        filtered.sort((a, b) => {
          const nameCompare = a.name.toLowerCase().localeCompare(b.name.toLowerCase())
          if (nameCompare !== 0) return nameCompare
          return parseFloat(a.price.toString()) - parseFloat(b.price.toString())
        })
        setFilteredProducts(filtered)
      }
    }

    performSearch()
  }, [barcodeInput, products, user?.currentShopId, isOnline])

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
              placeholder={t('scan_barcode') + ' or search by name/SKU (e.g., "candy x5")'}
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              maxLength={64}
              className="w-full text-lg h-11"
              autoFocus
            />
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
              Tip: Scan barcode or type name/SKU. Use &quot;x&quot; for quantity (e.g., &quot;candy x5&quot;).
            </p>
          </form>

          {/* Unified Search Suggestions (driven by barcodeInput) */}
          <div className="relative mb-4">
            {barcodeInput && filteredProducts.length > 0 && (
              <div className="absolute z-20 w-full bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {filteredProducts.slice(0, 15).map((product, index) => {
                  // Check if there are other products with the same name
                  const sameNameProducts = filteredProducts.filter(p => p.name === product.name)
                  const hasVariants = sameNameProducts.length > 1
                  
                  return (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => handleProductSearch(product)}
                      className="w-full px-4 py-2.5 text-left hover:bg-[hsl(var(--muted))] border-b border-[hsl(var(--border))] last:border-b-0"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm">{product.name}</div>
                          <div className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5 space-y-0.5">
                            {hasVariants && (
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-blue-600">Price: {formatCurrency(product.price)}</span>
                                {product.unit && <span>• {product.unit}</span>}
                              </div>
                            )}
                            <div className="flex items-center gap-2 flex-wrap">
                              {product.barcode && (
                                <span className="font-mono text-[10px] bg-gray-100 px-1.5 py-0.5 rounded">
                                  {product.barcode}
                                </span>
                              )}
                              {product.cartonSize && (
                                <span>Carton: {product.cartonSize} {product.unit}</span>
                              )}
                              {!hasVariants && product.unit && <span>{product.unit}</span>}
                            </div>
                          </div>
                        </div>
                        <div className="font-semibold text-sm text-right whitespace-nowrap">
                          {formatCurrency(product.price)}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Error/Success Messages */}
          {error && (
            <div className="mb-4 p-3 bg-red-100 text-red-700 rounded flex flex-col gap-2">
              <span>{error}</span>
              {canManageProducts && unfoundBarcode && (
                <Button
                  type="button"
                  size="sm"
                  className="self-start bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={() => {
                    setQuickAddProductForm({
                      name: '',
                      barcode: unfoundBarcode,
                      price: '',
                      unit: 'pcs',
                    })
                    setShowQuickAddProductModal(true)
                  }}
                >
                  Add as new product
                </Button>
              )}
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
            <div className="grid grid-cols-4 gap-1.5 p-2">
              {products.map((product) => {
                const hasCarton = product.cartonSize && product.cartonSize > 0 && product.cartonPrice
                const stock = productStock[product.id] ?? null
                const showStock = product.trackStock && stock !== null
                return (
                  <button
                    key={product.id}
                    onClick={() => {
                      if (hasCarton) {
                        // For products with cartons, show quick add modal
                        setQuickAddProduct(product)
                        setQuickAddQuantity('1')
                      } else {
                        // For regular products, add directly
                        addToCart(product, 1, false)
                      }
                    }}
                    className="p-1.5 border border-[hsl(var(--border))] rounded-md hover:bg-[hsl(var(--muted))] hover:border-blue-400 transition-colors text-left cursor-pointer active:scale-95"
                    title={hasCarton ? "Click to add (piece or carton)" : "Click to add to cart"}
                  >
                    <div className="font-medium text-xs leading-tight mb-0.5 truncate">{product.name}</div>
                    <div className="flex items-center justify-between mb-0.5">
                      <div className="font-semibold text-xs">{formatCurrency(product.price)}</div>
                      {showStock && (
                        <div className={`text-[10px] ${stock <= 0 ? 'text-red-600 font-semibold' : stock <= ((product as any).reorderLevel || 0) ? 'text-orange-600' : 'text-gray-500'}`}>
                          {formatNumber(stock)} {product.unit}
                        </div>
                      )}
                    </div>
                    {hasCarton && (
                      <div className="text-[10px] text-[hsl(var(--muted-foreground))] truncate">
                        Carton: {formatCurrency(product.cartonPrice!)}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Cart */}
      <div className="w-1/2 bg-[hsl(var(--card))] overflow-y-auto" ref={cartScrollRef}>
        <div className="p-4 sticky top-0 bg-[hsl(var(--card))] border-b border-[hsl(var(--border))] z-10">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-bold">{t('cart')}</h2>
            <Button
              variant="outline"
              className="h-8 px-3 text-sm"
              onClick={() => setShowHeldSalesModal(true)}
              disabled={heldSales.length === 0}
            >
              Held Sales ({heldSales.length})
            </Button>
          </div>
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
                      {formatCurrency(item.unitPrice)} × {formatNumber(item.quantity)} {item.product.unit}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateCartQuantity(item.product.id, item.quantity - 1)}
                      className="w-8 h-8 flex items-center justify-center border border-gray-300 rounded hover:bg-gray-100 hover:border-gray-400 text-gray-700 font-semibold text-lg"
                      title="Decrease quantity"
                    >
                      −
                    </button>
                    <Input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => updateCartQuantity(item.product.id, parseFloat(e.target.value) || 0)}
                      className="w-16 text-center p-1 h-8 border-gray-300 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      step="0.001"
                    />
                    <button
                      onClick={() => updateCartQuantity(item.product.id, item.quantity + 1)}
                      className="w-8 h-8 flex items-center justify-center border border-gray-300 rounded hover:bg-gray-100 hover:border-gray-400 text-gray-700 font-semibold text-lg"
                      title="Increase quantity"
                    >
                      +
                    </button>
                    <div className="w-24 text-right font-semibold">
                      {formatCurrency(item.lineTotal)}
                    </div>
                    <Button
                      onClick={() => removeFromCart(item.product.id)}
                      variant="outline"
                      className="ml-2 p-2"
                      title="Remove from cart"
                    >
                      <X className="w-4 h-4" />
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
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>{t('discount')}:</span>
                <Input
                  type="number"
                  step="1"
                  min={0}
                  max={Math.floor(subtotal)}
                  value={Math.round(discount).toString()}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 0
                    const rounded = Math.round(val)
                    setDiscount(Math.max(0, Math.min(Math.floor(subtotal), rounded)))
                  }}
                  className="w-24 text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  placeholder="0"
                />
              </div>
              <div className="flex justify-between">
                <span>{t('total')}:</span>
                <span>{formatCurrency(baseTotal)}</span>
              </div>
              {effectiveCardFeePercentForDisplay > 0 && (
                <div className="flex justify-between text-sm text-[hsl(var(--muted-foreground))]">
                  <span>Card Charges ({formatNumber(effectiveCardFeePercentForDisplay)}%):</span>
                  <span>{formatCurrency(cardFeeForDisplay)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-lg border-t pt-2">
                <span>{t('total')}:</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 h-12 text-lg font-semibold"
                  onClick={handleClearCart}
                >
                  Clear Cart
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 h-12 text-lg font-semibold bg-yellow-400 hover:bg-yellow-500 text-black border-yellow-500"
                  onClick={handleHoldSale}
                >
                  Hold Sale
                </Button>
                <Button onClick={handleCompleteSale} className="flex-1 h-12 text-lg font-semibold">
                  {t('complete_sale')}
                </Button>
              </div>
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
                  <div className="flex gap-2">
                    <select
                      value={customerId}
                      onChange={(e) => setCustomerId(e.target.value)}
                      required
                      className="input flex-1"
                    >
                      <option value="">Select customer</option>
                      {customers.map((customer) => (
                        <option key={customer.id} value={customer.id}>
                          {customer.name} {customer.phone && `(${customer.phone})`}
                        </option>
                      ))}
                    </select>
                    <Button
                      type="button"
                      variant="outline"
                      className="whitespace-nowrap"
                      onClick={() => {
                        setNewCustomerForm({ name: '', phone: '', notes: '', openingBalance: '' })
                        setShowNewCustomerModal(true)
                      }}
                    >
                      + {t('add')}
                    </Button>
                  </div>
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
                      onChange={(e) => {
                        const method = e.target.value as 'CASH' | 'CARD' | 'OTHER'
                        setPaymentMethod(method)
                        if (method === 'CARD') {
                          // When switching to CARD, initialize override from shop default if allowed
                          const defaultCardFee = Number(shopSettings?.cardFeePercent ?? 0)
                          setCardFeePercentOverride(defaultCardFee)
                        }
                      }}
                      className="input"
                    >
                      <option value="CASH">{t('cash')}</option>
                      <option value="CARD">{t('card')}</option>
                      <option value="OTHER">{t('other')}</option>
                    </select>
                  </div>

                  {/* Card fee override (if enabled and payment method is CARD) */}
                  {paymentMethod === 'CARD' && (
                    <div className="mt-2">
                      <label className="block text-sm font-medium mb-1">
                        Card Charges (%)
                      </label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          step="0.01"
                          min={0}
                          max={100}
                          value={
                            shopSettings?.allowCardFeeOverride
                              ? (cardFeePercentOverride ?? shopSettings?.cardFeePercent ?? 0)
                              : (shopSettings?.cardFeePercent ?? 0)
                          }
                          onChange={(e) => {
                            if (!shopSettings?.allowCardFeeOverride) return
                            const val = parseFloat(e.target.value)
                            setCardFeePercentOverride(Number.isNaN(val) ? 0 : val)
                          }}
                          disabled={!shopSettings?.allowCardFeeOverride}
                          className="w-24 text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <span className="text-xs text-[hsl(var(--muted-foreground))]">
                          Applied on total after discount
                        </span>
                      </div>
                    </div>
                  )}

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
                          {t('change')}: {formatCurrency(change)}
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
                  <span>{formatCurrency(total)}</span>
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
      {showReceiptModal && receiptInvoice && (
        <ReceiptModal
          isOpen={showReceiptModal}
          onClose={closeReceiptModal}
          invoice={receiptInvoice}
          printElementId="pos-print-receipt"
        />
      )}

      {/* Quick Add Quantity Modal */}
      {quickAddProduct && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-[hsl(var(--card))] rounded-lg p-6 w-full max-w-sm border border-[hsl(var(--border))]">
            <h2 className="text-xl font-bold mb-4">Add {quickAddProduct.name}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Quantity <span className="text-red-500">*</span>
                </label>
                <Input
                  type="number"
                  min="1"
                  value={quickAddQuantity}
                  onChange={(e) => setQuickAddQuantity(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleQuickAdd()
                    }
                    if (e.key === 'Escape') {
                      setQuickAddProduct(null)
                      setQuickAddQuantity('1')
                    }
                  }}
                  className="w-full text-lg"
                  autoFocus
                />
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                  Price: {formatCurrency(quickAddProduct.price)} per {quickAddProduct.unit}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setQuickAddProduct(null)
                    setQuickAddQuantity('1')
                  }}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleQuickAdd}
                >
                  Add to Cart
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Held Sales Modal */}
      {showHeldSalesModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-[hsl(var(--card))] rounded-lg p-6 w-full max-w-md border border-[hsl(var(--border))] max-h-[80vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Held Sales</h2>
            {heldSales.length === 0 ? (
              <div className="text-sm text-[hsl(var(--muted-foreground))] mb-4">
                No held sales.
              </div>
            ) : (
              <div className="space-y-3 mb-4">
                {heldSales
                  .slice()
                  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                  .map((held) => (
                    <div
                      key={held.id}
                      className="border border-[hsl(var(--border))] rounded-md p-3 flex items-center justify-between gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{held.note}</div>
                        <div className="text-xs text-[hsl(var(--muted-foreground))]">
                          {new Date(held.createdAt).toLocaleString()}
                          {' • '}
                          {held.cart.length} items
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          className="px-3 py-1 flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md"
                          onClick={() => resumeHeldSale(held)}
                        >
                          <Edit3 className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="px-3 py-1 flex items-center gap-1 text-red-600 border-red-300 hover:bg-red-50 rounded-md"
                          onClick={() => removeHeldSale(held.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setShowHeldSalesModal(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Hold Sale Note Modal */}
      {showHoldNoteModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-[hsl(var(--card))] rounded-lg p-6 w-full max-w-sm border border-[hsl(var(--border))]">
            <h2 className="text-xl font-bold mb-4">Hold Sale</h2>
            <div className="space-y-3 mb-4">
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                Add a short note to identify this held sale (optional). If left blank, it will be named automatically.
              </p>
              <Input
                placeholder="e.g. Customer in aisle 3"
                value={holdNoteDraft}
                onChange={(e) => setHoldNoteDraft(e.target.value)}
                autoFocus
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setShowHoldNoteModal(false)
                  setHoldNoteDraft('')
                }}
              >
                Cancel
              </Button>
              <Button
                className="bg-yellow-400 hover:bg-yellow-500 text-black"
                onClick={confirmHoldSale}
              >
                Hold
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Add Customer Modal (POS) */}
      {showNewCustomerModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-[hsl(var(--card))] rounded-lg p-6 w-full max-w-sm border border-[hsl(var(--border))]">
            <h2 className="text-xl font-bold mb-4">{t('add')} {t('customers')}</h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault()
                setCreatingCustomer(true)
                try {
                  const res = await fetch('/api/customers', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(newCustomerForm),
                  })
                  const data = await res.json()
                  if (!res.ok) {
                    throw new Error(data.error || 'Failed to create customer')
                  }
                  const created = data.customer as { id: string; name: string; phone: string | null }
                  // Update local customers list and select new customer
                  setCustomers((prev) => [
                    ...prev,
                    { id: created.id, name: created.name, phone: created.phone },
                  ])
                  setCustomerId(created.id)
                  setShowNewCustomerModal(false)
                  setNewCustomerForm({ name: '', phone: '', notes: '', openingBalance: '' })
                } catch (err: any) {
                  show({
                    title: 'Error',
                    message: err.message || 'Failed to create customer',
                    variant: 'destructive',
                  })
                } finally {
                  setCreatingCustomer(false)
                }
              }}
            >
              <div className="space-y-3 mb-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    {t('name')} <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={newCustomerForm.name}
                    onChange={(e) => setNewCustomerForm({ ...newCustomerForm, name: e.target.value })}
                    required
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t('phone')}</label>
                  <Input
                    value={newCustomerForm.phone}
                    onChange={(e) => setNewCustomerForm({ ...newCustomerForm, phone: e.target.value })}
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Notes</label>
                  <Input
                    value={newCustomerForm.notes}
                    onChange={(e) => setNewCustomerForm({ ...newCustomerForm, notes: e.target.value })}
                    placeholder="Optional (e.g. shop name, reference)"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Opening Balance</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={newCustomerForm.openingBalance}
                    onChange={(e) =>
                      setNewCustomerForm({ ...newCustomerForm, openingBalance: e.target.value })
                    }
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowNewCustomerModal(false)
                    setNewCustomerForm({ name: '', phone: '', notes: '', openingBalance: '' })
                  }}
                  disabled={creatingCustomer}
                >
                  {t('cancel')}
                </Button>
                <Button type="submit" disabled={creatingCustomer}>
                  {creatingCustomer ? t('processing') : t('save')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Add Product (from unfound barcode) - Store Manager only */}
      {showQuickAddProductModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-[hsl(var(--card))] rounded-lg p-6 w-full max-w-sm border border-[hsl(var(--border))]">
            <h2 className="text-xl font-bold mb-4">Add product</h2>
            <form onSubmit={handleQuickAddProductSubmit} className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Name <span className="text-red-500">*</span></label>
                <Input
                  value={quickAddProductForm.name}
                  onChange={(e) => setQuickAddProductForm({ ...quickAddProductForm, name: e.target.value })}
                  placeholder="Product name (saved in CAPS)"
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Barcode</label>
                <Input
                  value={quickAddProductForm.barcode}
                  onChange={(e) => setQuickAddProductForm({ ...quickAddProductForm, barcode: e.target.value })}
                  placeholder="Optional"
                />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-sm font-medium mb-1">Price <span className="text-red-500">*</span></label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={quickAddProductForm.price}
                    onChange={(e) => setQuickAddProductForm({ ...quickAddProductForm, price: e.target.value })}
                    placeholder="0.00"
                    required
                  />
                </div>
                <div className="w-28">
                  <label className="block text-sm font-medium mb-1">Unit</label>
                  <Select
                    value={quickAddProductForm.unit}
                    onChange={(e) =>
                      setQuickAddProductForm({ ...quickAddProductForm, unit: e.target.value })
                    }
                  >
                    <option value="pcs">pcs</option>
                    <option value="kg">kg</option>
                    <option value="g">g</option>
                    <option value="L">L</option>
                    <option value="mL">mL</option>
                    <option value="pack">pack</option>
                    <option value="box">box</option>
                    <option value="dozen">dozen</option>
                  </Select>
                </div>
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowQuickAddProductModal(false)
                    setQuickAddProductForm({ name: '', barcode: '', price: '', unit: 'pcs' })
                  }}
                  disabled={creatingProduct}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={creatingProduct}>
                  {creatingProduct ? 'Adding…' : 'Add & put in cart'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}