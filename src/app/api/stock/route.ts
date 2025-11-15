import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getShopStock, getProductStock } from '@/lib/domain/purchases'

// GET: Get stock for products
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    if (!user.currentShopId) {
      return NextResponse.json(
        { error: 'No shop selected' },
        { status: 400 }
      )
    }

    // Check if productId query param is provided (single product stock)
    const searchParams = request.nextUrl.searchParams
    const productId = searchParams.get('productId')

    if (productId) {
      const stock = await getProductStock(user.currentShopId, productId)
      return NextResponse.json({ productId, stock })
    }

    // Otherwise return all products stock
    const stock = await getShopStock(user.currentShopId)

    return NextResponse.json({ stock })
  } catch (error: any) {
    console.error('Get stock error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get stock' },
      { status: 500 }
    )
  }
}
