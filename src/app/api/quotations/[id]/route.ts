import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getQuotation } from '@/lib/domain/quotations'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    if (!user.currentShopId) return NextResponse.json({ error: 'No shop selected' }, { status: 400 })

    const quotation = await getQuotation(user.currentShopId, params.id)
    return NextResponse.json({ quotation })
  } catch (error: any) {
    const msg = error?.message || 'Failed to load quotation'
    return NextResponse.json({ error: msg }, { status: /not found/i.test(msg) ? 404 : 400 })
  }
}
