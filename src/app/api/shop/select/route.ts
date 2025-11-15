import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { cookies } from 'next/headers'
import { getUserShops } from '@/lib/domain/shops'

// POST: Select a shop (set currentShopId)
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()

    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await request.json()
    const { shopId } = body

    if (!shopId) {
      return NextResponse.json({ error: 'shopId is required' }, { status: 400 })
    }

    // Verify user has access to this shop
    const userShops = await getUserShops(session.userId)
    const hasAccess = userShops.some((us) => us.shopId === shopId)

    if (!hasAccess) {
      return NextResponse.json(
        { error: 'You do not have access to this shop' },
        { status: 403 }
      )
    }

    // Set current shop in cookie
    const cookieStore = await cookies()
    cookieStore.set('currentShopId', shopId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    })

    return NextResponse.json({ success: true, shopId })
  } catch (error: any) {
    console.error('Select shop error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to select shop' },
      { status: 500 }
    )
  }
}

