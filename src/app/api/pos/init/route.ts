import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getProductsForPOS } from '@/lib/domain/products'
import { getShopStock } from '@/lib/domain/purchases'
import { prisma } from '@/lib/db/prisma'
import { canMakeSales, hasShopAccess, UnauthorizedResponse, ForbiddenResponse } from '@/lib/permissions'

// GET: Combined POS initialization endpoint
// Returns products, stock, settings, and customers in one call
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return UnauthorizedResponse()
    }

    if (!user.currentShopId) {
      return NextResponse.json(
        { error: 'No shop selected' },
        { status: 400 }
      )
    }

    // Check permission - both STORE_MANAGER and CASHIER can access POS
    if (!canMakeSales(user, user.currentShopId)) {
      return ForbiddenResponse('You do not have permission to access POS')
    }

    // Fetch all data in parallel for maximum performance
    const [products, stock, settings, customers] = await Promise.all([
      // Products
      getProductsForPOS(user.currentShopId),
      
      // Stock (optimized batch query)
      getShopStock(user.currentShopId),
      
      // Settings (with default fallback)
      prisma.shopSettings.findUnique({
        where: { shopId: user.currentShopId },
      }).then(s => s || {
          shopId: user.currentShopId,
          requireCostPriceForStockItems: false,
          requireBarcodeForProducts: false,
          allowCustomUnits: true,
          allowNegativeStock: true,
          languageMode: 'EN_BILINGUAL' as const,
          printerName: null,
          autoPrint: false,
        }),
      
      // Customers (limit to 1000 for POS)
      prisma.customer.findMany({
        where: { shopId: user.currentShopId },
        orderBy: { name: 'asc' },
        take: 1000,
        select: {
          id: true,
          name: true,
          phone: true,
          notes: true,
        },
      }),
    ])

    // Convert stock array to map for easier lookup
    const stockMap: Record<string, number> = {}
    stock.forEach(item => {
      stockMap[item.productId] = item.stock
    })

    return NextResponse.json({
      products,
      stock: stockMap,
      settings: {
        allowNegativeStock: settings.allowNegativeStock,
        // Include other settings if needed
      },
      customers,
    })
  } catch (error: any) {
    console.error('POS init error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to initialize POS' },
      { status: 500 }
    )
  }
}

