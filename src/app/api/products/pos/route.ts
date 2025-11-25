import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getProductsForPOS } from '@/lib/domain/products'
import { canMakeSales, hasShopAccess, UnauthorizedResponse, ForbiddenResponse } from '@/lib/permissions'

// GET: Get products for POS (lightweight, no pagination)
// Accessible by both STORE_MANAGER and CASHIER
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

    const products = await getProductsForPOS(user.currentShopId)

    return NextResponse.json({ products })
  } catch (error: any) {
    console.error('Get products for POS error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get products' },
      { status: 500 }
    )
  }
}
