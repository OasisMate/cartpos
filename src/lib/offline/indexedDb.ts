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

// Database class
class CartPOSDatabase extends Dexie {
  meta!: Table<MetaRecord, string>
  products!: Table<CachedProduct, string>
  customers!: Table<CachedCustomer, string>
  suppliers!: Table<CachedSupplier, string>

  constructor() {
    super('CartPOS_DB')
    this.version(1).stores({
      meta: 'key', // key-value pairs
      products: 'id, shopId, barcode, updatedAt', // indexed by id, shopId, barcode, updatedAt
      customers: 'id, shopId, name, phone, syncStatus, updatedAt',
      suppliers: 'id, shopId, name, syncStatus, updatedAt',
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
  return await db.products.where('shopId').equals(shopId).toArray()
}

export async function getProductByBarcode(shopId: string, barcode: string): Promise<CachedProduct | undefined> {
  return await db.products.where('[shopId+barcode]').equals([shopId, barcode]).first()
}

export async function searchProducts(shopId: string, searchTerm: string): Promise<CachedProduct[]> {
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
  return await db.suppliers.where('shopId').equals(shopId).toArray()
}
