import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { DemoBlockedResponse } from '@/lib/demo'
import { importProducts } from '@/lib/domain/product-import'

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    if (!user.currentShopId) return NextResponse.json({ error: 'No shop selected' }, { status: 400 })
    if (user.isDemoOrg) return DemoBlockedResponse()

    const body = await request.json()
    const rows = Array.isArray(body) ? body : body?.rows
    const result = await importProducts(user.currentShopId, rows, user.id)
    return NextResponse.json({ success: true, ...result })
  } catch (error: any) {
    const msg = error?.message || 'Failed to import products'
    const status = /permission/i.test(msg) ? 403 : 400
    return NextResponse.json({ error: msg }, { status })
  }
}
