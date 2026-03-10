import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getRangeSummary } from '@/lib/domain/reports'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    if (!user.currentShopId) {
      return NextResponse.json({ error: 'No shop selected' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    if (!from || !to) {
      return NextResponse.json({ error: 'Missing from/to dates' }, { status: 400 })
    }

    const summary = await getRangeSummary(user.currentShopId, from, to)
    return NextResponse.json({ summary })
  } catch (error: any) {
    console.error('Range summary error:', error)
    return NextResponse.json({ error: error.message || 'Failed to get summary' }, { status: 500 })
  }
}

