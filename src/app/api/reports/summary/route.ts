import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { canViewReports } from '@/lib/permissions'
import { getRangeSummary } from '@/lib/domain/reports'
import { getShopTimezone } from '@/lib/db/shop-timezone'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    if (!user.currentShopId) {
      return NextResponse.json({ error: 'No shop selected' }, { status: 400 })
    }
    // Cashiers must not see financial reports — only managers/owners/admins.
    if (!canViewReports(user, user.currentShopId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    if (!from || !to) {
      return NextResponse.json({ error: 'Missing from/to dates' }, { status: 400 })
    }

    const timezone = await getShopTimezone(user.currentShopId)
    const summary = await getRangeSummary(user.currentShopId, from, to, timezone)
    return NextResponse.json({ summary })
  } catch (error: any) {
    console.error('Range summary error:', error)
    return NextResponse.json({ error: error.message || 'Failed to get summary' }, { status: 500 })
  }
}

