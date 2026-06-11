import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getReturnableInvoice } from '@/lib/domain/returns'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    if (!user.currentShopId) return NextResponse.json({ error: 'No shop selected' }, { status: 400 })

    const data = await getReturnableInvoice(params.id, user.id)
    return NextResponse.json({ invoice: data })
  } catch (error: any) {
    const msg = error?.message || 'Failed to load invoice'
    const status = /permission/i.test(msg) ? 403 : /not found|completed/i.test(msg) ? 404 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
