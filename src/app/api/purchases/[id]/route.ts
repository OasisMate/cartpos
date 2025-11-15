import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getPurchase } from '@/lib/domain/purchases'

// GET: Get single purchase
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const purchase = await getPurchase(params.id, user.id)

    return NextResponse.json({ purchase })
  } catch (error: any) {
    console.error('Get purchase error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get purchase' },
      { status: 404 }
    )
  }
}
