import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { voidSale } from '@/lib/domain/sales'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    if (!user.currentShopId) {
      return NextResponse.json({ error: 'No shop selected' }, { status: 400 })
    }

    const result = await voidSale(user.currentShopId, params.id, user.id)
    return NextResponse.json({ invoice: result })
  } catch (error: any) {
    console.error('Void sale error:', error)
    return NextResponse.json({ error: error.message || 'Failed to void sale' }, { status: 500 })
  }
}

