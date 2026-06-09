import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { markNotificationsRead } from '@/lib/domain/notifications'

// POST: mark notifications read. Body { ids?: string[] } — omit ids to mark all read.
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    let ids: string[] | undefined
    try {
      const body = await request.json()
      if (Array.isArray(body?.ids)) {
        ids = body.ids.filter((x: unknown): x is string => typeof x === 'string')
      }
    } catch {
      // no body → mark all
    }

    await markNotificationsRead(user.id, ids)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Mark notifications read error:', error)
    return NextResponse.json({ error: 'Failed to update notifications' }, { status: 500 })
  }
}
