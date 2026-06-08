import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { canViewReports } from '@/lib/permissions'
import { getDailySummary } from '@/lib/domain/reports'

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
    const date = searchParams.get('date')
    if (!date) {
      return NextResponse.json({ error: 'Missing date' }, { status: 400 })
    }

    const summary = await getDailySummary(user.currentShopId, date)
    return NextResponse.json({ summary })
  } catch (error: any) {
    console.error('Daily summary error:', error)
    return NextResponse.json({ error: error.message || 'Failed to get summary' }, { status: 500 })
  }
}

