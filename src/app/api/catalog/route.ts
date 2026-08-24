import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { searchCatalog } from '@/lib/domain/catalog'
import { verticalForShop } from '@/lib/domain/catalog-context'

/** Browse the shared catalog, scoped to this shop's vertical. */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    if (!user.currentShopId) return NextResponse.json({ error: 'No shop selected' }, { status: 400 })

    const q = request.nextUrl.searchParams
    const result = await searchCatalog({
      vertical: await verticalForShop(user.currentShopId),
      search: q.get('search'),
      category: q.get('category'),
      page: parseInt(q.get('page') || '1', 10) || 1,
      limit: parseInt(q.get('limit') || '50', 10) || 50,
      shopId: user.currentShopId,
    })
    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to load catalog' }, { status: 400 })
  }
}
