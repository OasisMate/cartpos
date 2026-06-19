import { saveProducts, getProducts, getProductByBarcode, searchProducts, CachedProduct } from './indexedDb'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'

// Product type matching API response
export interface Product {
  id: string
  name: string
  barcode: string | null
  unit: string
  price: number
  tradePrice?: number | null
  cartonPrice?: number | null
  trackStock: boolean
  cartonSize?: number | null
  cartonBarcode?: string | null
  packagingLevels?: Array<{ name: string; factorToBase: number; price: number | null; barcode: string | null; level: number }>
}

/**
 * Fetch products from API and cache them in IndexedDB
 */
export async function fetchAndCacheProducts(shopId: string): Promise<Product[]> {
  try {
    const response = await fetch('/api/products/pos')
    if (!response.ok) {
      throw new Error('Failed to fetch products')
    }

    const data = await response.json()
    const products: Product[] = data.products || []

    // Cache products in IndexedDB
    await saveProducts(shopId, products)

    return products
  } catch (error) {
    console.error('Error fetching products:', error)
    throw error
  }
}

/**
 * Get products from cache (IndexedDB)
 */
export async function getCachedProducts(shopId: string): Promise<CachedProduct[]> {
  return await getProducts(shopId)
}

/**
 * Get products - try API first if online, fallback to cache
 */
export async function getProductsWithCache(shopId: string, isOnline: boolean): Promise<Product[]> {
  if (isOnline) {
    try {
      // Try to fetch from API and update cache
      const products = await fetchAndCacheProducts(shopId)
      return products
    } catch (error) {
      console.warn('Failed to fetch products from API, using cache:', error)
      // Fallback to cache if API fails
      const cached = await getCachedProducts(shopId)
      return cached.map((p) => ({
        id: p.id,
        name: p.name,
        barcode: p.barcode,
        unit: p.unit,
        price: p.price,
        tradePrice: p.tradePrice,
        cartonPrice: p.cartonPrice,
        trackStock: p.trackStock,
        cartonSize: p.cartonSize,
        cartonBarcode: p.cartonBarcode,
        packagingLevels: (p as any).packagingLevels,
      }))
    }
  } else {
    // Offline: use cache only
    const cached = await getCachedProducts(shopId)
    return cached.map((p) => ({
      id: p.id,
      name: p.name,
      barcode: p.barcode,
      unit: p.unit,
      price: p.price,
      tradePrice: p.tradePrice,
      cartonPrice: p.cartonPrice,
      trackStock: p.trackStock,
      cartonSize: p.cartonSize,
      cartonBarcode: p.cartonBarcode,
    }))
  }
}

/**
 * Find product by barcode
 */
export async function findProductByBarcode(shopId: string, barcode: string): Promise<CachedProduct | undefined> {
  return await getProductByBarcode(shopId, barcode)
}

/**
 * Search products (searches in cache)
 */
export async function searchCachedProducts(shopId: string, searchTerm: string): Promise<CachedProduct[]> {
  return await searchProducts(shopId, searchTerm)
}
