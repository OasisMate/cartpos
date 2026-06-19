import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getExpiringLots } from '@/lib/domain/expiry'

// GET: expired + soon-to-expire batches for the current shop (batch/expiry shops only).
export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (!user.currentShopId) return NextResponse.json({ error: 'No shop selected' }, { status: 400 })
  if (user.features?.batchExpiry !== true) {
    // Feature off for this shop: nothing to report.
    return NextResponse.json({ expired: [], expiring: [] })
  }

  const within = Number(new URL(request.url).searchParams.get('days')) || 60
  const data = await getExpiringLots(user.currentShopId, within)
  return NextResponse.json(data)
}
