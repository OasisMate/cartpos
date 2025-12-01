/**
 * Offline-aware data fetching utilities
 * All functions try API first if online, cache the response, and fall back to cache when offline
 */

import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { 
  getCustomers, 
  saveCustomers, 
  getSuppliers, 
  saveSuppliers,
  getProducts,
  getSales,
  CachedCustomer,
  CachedSupplier,
  CachedProduct,
  CachedSale
} from './indexedDb'
import { getProductsWithCache } from './products'

// Customers
export async function fetchAndCacheCustomers(shopId: string): Promise<CachedCustomer[]> {
  try {
    const response = await fetch(`/api/customers?limit=1000`)
    if (!response.ok) {
      throw new Error('Failed to fetch customers')
    }
    const data = await response.json()
    const customers = data.customers || data || []
    
    // Cache customers
    await saveCustomers(shopId, customers.map((c: any) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      notes: c.notes || null,
    })))
    
    return customers.map((c: any) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      notes: c.notes || null,
      shopId,
      updatedAt: Date.now(),
      syncStatus: 'SYNCED' as const,
    }))
  } catch (error) {
    console.error('Error fetching customers:', error)
    throw error
  }
}

export async function getCustomersWithCache(shopId: string, isOnline: boolean): Promise<CachedCustomer[]> {
  if (isOnline) {
    try {
      return await fetchAndCacheCustomers(shopId)
    } catch (error) {
      console.warn('Failed to fetch customers from API, using cache:', error)
      return await getCustomers(shopId)
    }
  } else {
    return await getCustomers(shopId)
  }
}

// Suppliers
export async function fetchAndCacheSuppliers(shopId: string): Promise<CachedSupplier[]> {
  try {
    const response = await fetch(`/api/suppliers?limit=1000`)
    if (!response.ok) {
      throw new Error('Failed to fetch suppliers')
    }
    const data = await response.json()
    const suppliers = data.suppliers || data || []
    
    // Cache suppliers
    await saveSuppliers(shopId, suppliers.map((s: any) => ({
      id: s.id,
      name: s.name,
      phone: s.phone || null,
      notes: s.notes || null,
    })))
    
    return suppliers.map((s: any) => ({
      id: s.id,
      name: s.name,
      phone: s.phone || null,
      notes: s.notes || null,
      shopId,
      updatedAt: Date.now(),
      syncStatus: 'SYNCED' as const,
    }))
  } catch (error) {
    console.error('Error fetching suppliers:', error)
    throw error
  }
}

export async function getSuppliersWithCache(shopId: string, isOnline: boolean): Promise<CachedSupplier[]> {
  if (isOnline) {
    try {
      return await fetchAndCacheSuppliers(shopId)
    } catch (error) {
      console.warn('Failed to fetch suppliers from API, using cache:', error)
      return await getSuppliers(shopId)
    }
  } else {
    return await getSuppliers(shopId)
  }
}

// Products (already exists in products.ts, re-export for consistency)
export { getProductsWithCache }

// Sales
export async function getSalesWithCache(shopId: string, isOnline: boolean): Promise<CachedSale[]> {
  // Sales are primarily read from cache (they're written locally first)
  // If online, we could fetch from API, but for now just use cache
  // The sync process handles syncing pending sales to server
  return await getSales(shopId)
}



