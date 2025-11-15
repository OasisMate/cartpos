import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getProductsForPOS } from '@/lib/domain/products'

// GET: Get products for POS (lightweight, no pagination)
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
