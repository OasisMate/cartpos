import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { clearNotifications } from '@/lib/domain/notifications'

// POST: delete notifications. Body { ids?: string[] } — omit ids to clear all.
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
      // no body → clear all
    }

    await clearNotifications(user.id, ids)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Clear notifications error:', error)
    return NextResponse.json({ error: 'Failed to clear notifications' }, { status: 500 })
  }
}
