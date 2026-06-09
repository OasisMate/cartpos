import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { listNotifications } from '@/lib/domain/notifications'

// GET: recent notifications + unread count for the current user
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const limit = Math.min(
      50,
      Math.max(1, parseInt(request.nextUrl.searchParams.get('limit') || '20', 10) || 20)
    )

    const result = await listNotifications(user.id, limit)
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('List notifications error:', error)
    return NextResponse.json({ error: 'Failed to load notifications' }, { status: 500 })
  }
}
