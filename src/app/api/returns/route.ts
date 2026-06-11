import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { DemoBlockedResponse } from '@/lib/demo'
import { createReturn } from '@/lib/domain/returns'

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    if (!user.currentShopId) return NextResponse.json({ error: 'No shop selected' }, { status: 400 })
    if (user.isDemoOrg) return DemoBlockedResponse()

    const body = await request.json()
    const result = await createReturn(user.currentShopId, user.id, body)
    return NextResponse.json({ success: true, returnId: result.id })
  } catch (error: any) {
    const msg = error?.message || 'Failed to process return'
    const status = /permission/i.test(msg) ? 403 : /not found/i.test(msg) ? 404 : 400
    return NextResponse.json({ error: msg }, { status })
  }
}
