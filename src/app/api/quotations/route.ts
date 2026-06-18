import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { DemoBlockedResponse } from '@/lib/demo'
import { createQuotation, listQuotations } from '@/lib/domain/quotations'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    if (!user.currentShopId) return NextResponse.json({ error: 'No shop selected' }, { status: 400 })

    const { searchParams } = new URL(request.url)
    const quotations = await listQuotations(user.currentShopId, {
      status: searchParams.get('status') || undefined,
      search: searchParams.get('search') || undefined,
    })
    return NextResponse.json({ quotations })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to load quotations' }, { status: 400 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    if (!user.currentShopId) return NextResponse.json({ error: 'No shop selected' }, { status: 400 })
    if (user.features?.quotations === false) {
      return NextResponse.json({ error: 'Quotations are not enabled for this shop' }, { status: 403 })
    }
    if (user.isDemoOrg) return DemoBlockedResponse()

    const body = await request.json()
    const quotation = await createQuotation(user.currentShopId, body, user.id)
    return NextResponse.json({ success: true, quotation })
  } catch (error: any) {
    const msg = error?.message || 'Failed to create quotation'
    return NextResponse.json({ error: msg }, { status: /permission/i.test(msg) ? 403 : 400 })
  }
}
