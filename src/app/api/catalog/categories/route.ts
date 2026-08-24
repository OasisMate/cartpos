import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { listCatalogCategories } from '@/lib/domain/catalog'
import { verticalForShop } from '@/lib/domain/catalog-context'

/** Category filter options, with counts, for the picker sidebar. */
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    if (!user.currentShopId) return NextResponse.json({ error: 'No shop selected' }, { status: 400 })

    const categories = await listCatalogCategories(await verticalForShop(user.currentShopId))
    return NextResponse.json({ categories })
  } catch {
    return NextResponse.json({ categories: [] })
  }
}
