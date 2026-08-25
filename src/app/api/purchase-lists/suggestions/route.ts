import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { suggestReorderItems } from '@/lib/domain/purchaseLists'
import { purchaseListErrorResponse } from '@/lib/purchaseLists/httpErrors'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    if (!user.currentShopId) return NextResponse.json({ error: 'No shop selected' }, { status: 400 })

    const params = request.nextUrl.searchParams
    const { suggestions, hasAnySales } = await suggestReorderItems(user.currentShopId, {
      days: parseInt(params.get('days') || '30', 10) || 30,
      limit: parseInt(params.get('limit') || '50', 10) || 50,
      excludeListId: params.get('listId') || undefined,
    })
    return NextResponse.json({ suggestions, hasAnySales })
  } catch (error: any) {
    return purchaseListErrorResponse(error, 'Suggest reorder items error:')
  }
}
