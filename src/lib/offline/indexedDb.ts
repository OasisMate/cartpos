import Dexie, { Table } from 'dexie'

// Meta store type
export interface MetaRecord {
  key: string
  value: any
}

// Product store type (cached from /api/products/pos)
export interface CachedProduct {
  id: string
  shopId: string
  name: string
  barcode: string | null
  unit: string
  price: number
  trackStock: boolean
  updatedAt: number // timestamp
}

// Customer store type
export interface CachedCustomer {
  id: string
  shopId: string
  name: string
  phone: string | null
  notes: string | null
  isLocalOnly?: boolean
  syncStatus?: 'SYNCED' | 'PENDING'
  updatedAt: number
}

// Supplier store type
export interface CachedSupplier {
  id: string
  shopId: string
  name: string
  phone: string | null
  notes: string | null
  isLocalOnly?: boolean
  syncStatus?: 'SYNCED' | 'PENDING'
  updatedAt: number
}

// Sale store type (for offline sales)
export interface CachedSale {
  id: string // client-generated ID (cuid or uuid)
  shopId: string
  customerId?: string
  items: Array<{
    productId: string
    quantity: number
    unitPrice: number
    lineTotal: number
  }>
  subtotal: number
  discount: number
  total: number
  paymentStatus: 'PAID' | 'UDHAAR'
  paymentMethod?: 'CASH' | 'CARD' | 'OTHER'
  amountReceived?: number
  createdAt: number // timestamp
  syncStatus: 'PENDING' | 'SYNCED'
  syncError?: string
}

// Database class
class CartPOSDatabase extends Dexie {
  meta!: Table<MetaRecord, string>
  products!: Table<CachedProduct, string>
  customers!: Table<CachedCustomer, string>
  suppliers!: Table<CachedSupplier, string>
  sales!: Table<CachedSale, string>
  // purchases and udhaarPayments are added in later versions via dynamic any-access

  constructor() {
    super('CartPOS_DB')
    this.version(1).stores({
      meta: 'key', // key-value pairs
      products: 'id, shopId, barcode, updatedAt', // indexed by id, shopId, barcode, updatedAt
      customers: 'id, shopId, name, phone, syncStatus, updatedAt',
      suppliers: 'id, shopId, name, syncStatus, updatedAt',
    })
    this.version(2).stores({
      meta: 'key',
      products: 'id, shopId, barcode, updatedAt',
      customers: 'id, shopId, name, phone, syncStatus, updatedAt',
      suppliers: 'id, shopId, name, syncStatus, updatedAt',
      sales: 'id, shopId, syncStatus, createdAt', // indexed by id, shopId, syncStatus, createdAt
    })
    this.version(3).stores({
      meta: 'key',
      products: 'id, shopId, barcode, updatedAt',
      customers: 'id, shopId, name, phone, syncStatus, updatedAt',
      suppliers: 'id, shopId, name, syncStatus, updatedAt',
      sales: 'id, shopId, syncStatus, createdAt',
      purchases: 'id, shopId, syncStatus, createdAt', // new purchases store
      udhaarPayments: 'id, shopId, customerId, syncStatus, createdAt', // new payments store
    })
  }
}

// Export singleton instance
export const db = new CartPOSDatabase()

// Helper functions for meta store
export async function getMeta(key: string): Promise<any> {
  const record = await db.meta.get(key)
  return record?.value
}

export async function setMeta(key: string, value: any): Promise<void> {
  await db.meta.put({ key, value })
}

export async function deleteMeta(key: string): Promise<void> {
  await db.meta.delete(key)
}

// Helper functions for products store
export async function saveProducts(shopId: string, products: Omit<CachedProduct, 'shopId' | 'updatedAt'>[]): Promise<void> {
  // Skip if no shopId (Platform Admin case)
  if (!shopId) return

  const now = Date.now()
  const productsWithMetadata = products.map((product) => ({
    ...product,
    shopId,
    updatedAt: now,
  }))

  // Delete old products for this shop
  await db.products.where('shopId').equals(shopId).delete()

  // Insert new products
  await db.products.bulkPut(productsWithMetadata)
}

export async function getProducts(shopId: string): Promise<CachedProduct[]> {
  // Skip if no shopId (Platform Admin case)
  if (!shopId) return []
  
  return await db.products.where('shopId').equals(shopId).toArray()
}

export async function getProductByBarcode(shopId: string, barcode: string): Promise<CachedProduct | undefined> {
  // Skip if no shopId (Platform Admin case)
  if (!shopId) return undefined
  
  return await db.products.where('[shopId+barcode]').equals([shopId, barcode]).first()
}

export async function searchProducts(shopId: string, searchTerm: string): Promise<CachedProduct[]> {
  // Skip if no shopId (Platform Admin case)
  if (!shopId) return []
  
  const term = searchTerm.toLowerCase()
  const products = await db.products.where('shopId').equals(shopId).toArray()

  return products.filter(
    (product) =>
      product.name.toLowerCase().includes(term) ||
      (product.barcode && product.barcode.includes(term))
  )
}

// Helper functions for customers store
export async function saveCustomers(shopId: string, customers: Omit<CachedCustomer, 'shopId' | 'updatedAt'>[]): Promise<void> {
  // Skip if no shopId (Platform Admin case)
  if (!shopId) return

  const now = Date.now()
  const customersWithMetadata = customers.map((customer) => ({
    ...customer,
    shopId,
    updatedAt: now,
  }))

  // Delete old customers for this shop (except local-only ones)
  await db.customers.where('shopId').equals(shopId).and((c) => !c.isLocalOnly).delete()

  // Insert new customers (upsert to preserve local-only ones)
  await db.customers.bulkPut(customersWithMetadata)
}

export async function getCustomers(shopId: string): Promise<CachedCustomer[]> {
  // Skip if no shopId (Platform Admin case)
  if (!shopId) return []
  
  return await db.customers.where('shopId').equals(shopId).toArray()
}

export async function addCustomer(customer: Omit<CachedCustomer, 'updatedAt'>): Promise<string> {
  const customerWithTimestamp = {
    ...customer,
    updatedAt: Date.now(),
    isLocalOnly: true,
    syncStatus: 'PENDING' as const,
  }
  await db.customers.add(customerWithTimestamp)
  return customer.id
}

// Helper functions for suppliers store
export async function saveSuppliers(shopId: string, suppliers: Omit<CachedSupplier, 'shopId' | 'updatedAt'>[]): Promise<void> {
  // Skip if no shopId (Platform Admin case)
  if (!shopId) return

  const now = Date.now()
  const suppliersWithMetadata = suppliers.map((supplier) => ({
    ...supplier,
    shopId,
    updatedAt: now,
  }))

  // Delete old suppliers for this shop (except local-only ones)
  await db.suppliers.where('shopId').equals(shopId).and((s) => !s.isLocalOnly).delete()

  // Insert new suppliers (upsert to preserve local-only ones)
  await db.suppliers.bulkPut(suppliersWithMetadata)
}

export async function getSuppliers(shopId: string): Promise<CachedSupplier[]> {
  // Skip if no shopId (Platform Admin case)
  if (!shopId) return []
  
  return await db.suppliers.where('shopId').equals(shopId).toArray()
}

// Helper functions for sales store
export async function addSale(sale: Omit<CachedSale, 'createdAt' | 'syncStatus'>): Promise<string> {
  const saleWithMetadata: CachedSale = {
    ...sale,
    createdAt: Date.now(),
    syncStatus: 'PENDING',
  }
  await db.sales.add(saleWithMetadata)
  return sale.id
}

export async function getPendingSales(shopId: string): Promise<CachedSale[]> {
  // Skip if no shopId (Platform Admin case)
  if (!shopId) return []
  
  return await db.sales
    .where('[shopId+syncStatus]')
    .equals([shopId, 'PENDING'])
    .toArray()
}

export async function getSales(shopId: string): Promise<CachedSale[]> {
  // Skip if no shopId (Platform Admin case)
  if (!shopId) return []
  
  return await db.sales.where('shopId').equals(shopId).toArray()
}

export async function markSaleAsSynced(saleId: string): Promise<void> {
  await db.sales.update(saleId, { syncStatus: 'SYNCED', syncError: undefined })
}

export async function markSaleSyncError(saleId: string, error: string): Promise<void> {
  await db.sales.update(saleId, { syncError: error })
}

export async function deleteSale(saleId: string): Promise<void> {
  await db.sales.delete(saleId)
}

// Purchase store type (for offline purchases)
export interface CachedPurchase {
  id: string // client-generated ID
  shopId: string
  supplierId?: string
  date?: number
  reference?: string
  notes?: string
  lines: Array<{
    productId: string
    quantity: number
    unitCost?: number
  }>
  createdAt: number
  syncStatus: 'PENDING' | 'SYNCED'
  syncError?: string
}

// Dexie table type
declare module 'dexie' {
  interface Dexie {
    purchases: Table<CachedPurchase, string>
  }
}

// Helper functions for purchases store
export async function addPurchaseLocal(purchase: Omit<CachedPurchase, 'createdAt' | 'syncStatus'>): Promise<string> {
  const record: CachedPurchase = {
    ...purchase,
    createdAt: Date.now(),
    syncStatus: 'PENDING',
  }
  await (db as any).purchases.add(record)
  return purchase.id
}

export async function getPendingPurchases(shopId: string): Promise<CachedPurchase[]> {
  // Skip if no shopId (Platform Admin case)
  if (!shopId) return []
  
  return await (db as any).purchases.where('[shopId+syncStatus]').equals([shopId, 'PENDING']).toArray()
}

export async function markPurchaseAsSynced(id: string): Promise<void> {
  await (db as any).purchases.update(id, { syncStatus: 'SYNCED', syncError: undefined })
}

export async function markPurchaseSyncError(id: string, error: string): Promise<void> {
  await (db as any).purchases.update(id, { syncError: error })
}

// Customers pending helpers (reuse existing customers store)
export async function getPendingCustomers(shopId: string): Promise<CachedCustomer[]> {
  // Skip if no shopId (Platform Admin case)
  if (!shopId) return []
  
  return await db.customers
    .where('[shopId+syncStatus]')
    .equals([shopId, 'PENDING'])
    .toArray()
}

export async function markCustomerAsSynced(id: string): Promise<void> {
  await db.customers.update(id, { syncStatus: 'SYNCED', isLocalOnly: false, updatedAt: Date.now(), })
}

export async function markCustomerSyncError(id: string, error: string): Promise<void> {
  await db.customers.update(id, { syncStatus: 'PENDING', updatedAt: Date.now() })
  // keep error tracking minimal; customers store has no dedicated error field
}

// Udhaar payments store
export interface CachedUdhaarPayment {
  id: string
  shopId: string
  customerId: string
  amount: number
  method: 'CASH' | 'CARD' | 'OTHER'
  note?: string
  createdAt: number
  syncStatus: 'PENDING' | 'SYNCED'
  syncError?: string
}

declare module 'dexie' {
  interface Dexie {
    udhaarPayments: Table<CachedUdhaarPayment, string>
  }
}

export async function addUdhaarPaymentLocal(payment: Omit<CachedUdhaarPayment, 'createdAt' | 'syncStatus'>) {
  const record: CachedUdhaarPayment = {
    ...payment,
    createdAt: Date.now(),
    syncStatus: 'PENDING',
  }
  await (db as any).udhaarPayments.add(record)
}

export async function getPendingUdhaarPayments(shopId: string): Promise<CachedUdhaarPayment[]> {
  // Skip if no shopId (Platform Admin case)
  if (!shopId) return []
  
  return await (db as any).udhaarPayments.where('[shopId+syncStatus]').equals([shopId, 'PENDING']).toArray()
}

export async function markUdhaarPaymentAsSynced(id: string): Promise<void> {
  await (db as any).udhaarPayments.update(id, { syncStatus: 'SYNCED', syncError: undefined })
}

export async function markUdhaarPaymentSyncError(id: string, error: string): Promise<void> {
  await (db as any).udhaarPayments.update(id, { syncError: error })
}
