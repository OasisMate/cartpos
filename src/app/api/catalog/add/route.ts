import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { DemoBlockedResponse } from '@/lib/demo'
import { addFromCatalog } from '@/lib/domain/catalog-import'

/** Add picked catalog items to the current shop, with the prices they set. */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    if (!user.currentShopId) return NextResponse.json({ error: 'No shop selected' }, { status: 400 })
    if (user.isDemoOrg) return DemoBlockedResponse()

    const body = await request.json()
    const picks = Array.isArray(body) ? body : body?.picks
    if (!Array.isArray(picks) || picks.length === 0) {
      return NextResponse.json({ error: 'No products selected' }, { status: 400 })
    }
    if (picks.length > 2000) {
      return NextResponse.json({ error: 'Too many products at once (max 2000)' }, { status: 400 })
    }

    const result = await addFromCatalog(user.currentShopId, user.id, picks)
    return NextResponse.json({ success: true, ...result })
  } catch (error: any) {
    const msg = error?.message || 'Failed to add products'
    return NextResponse.json({ error: msg }, { status: /permission/i.test(msg) ? 403 : 400 })
  }
}
