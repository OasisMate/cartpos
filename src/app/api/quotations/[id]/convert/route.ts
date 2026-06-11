import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { DemoBlockedResponse } from '@/lib/demo'
import { convertQuotation } from '@/lib/domain/quotations'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    if (!user.currentShopId) return NextResponse.json({ error: 'No shop selected' }, { status: 400 })
    if (user.isDemoOrg) return DemoBlockedResponse()

    const body = await request.json()
    const result = await convertQuotation(user.currentShopId, params.id, user.id, body)
    return NextResponse.json({ success: true, ...result })
  } catch (error: any) {
    const msg = error?.message || 'Failed to convert quotation'
    const status = /permission/i.test(msg) ? 403 : /not found/i.test(msg) ? 404 : 400
    return NextResponse.json({ error: msg }, { status })
  }
}
