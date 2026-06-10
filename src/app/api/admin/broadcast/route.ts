import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { runBroadcast, type BroadcastAudience } from '@/lib/domain/broadcast'

const AUDIENCES: BroadcastAudience[] = ['ALL_USERS', 'ALL_ORG_ADMINS', 'ORGS', 'USERS']

export async function POST(request: Request) {
  const admin = await getCurrentUser()
  if (!admin || admin.role !== 'PLATFORM_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const audience = body?.audience as BroadcastAudience
  const orgIds = Array.isArray(body?.orgIds) ? body.orgIds : []
  const userIds = Array.isArray(body?.userIds) ? body.userIds : []
  const inApp = Boolean(body?.channels?.inApp)
  const email = Boolean(body?.channels?.email)
  const subject = (body?.subject || '').trim()
  const message = (body?.message || '').trim()
  const href = (body?.href || '').trim() || null

  if (!AUDIENCES.includes(audience)) {
    return NextResponse.json({ error: 'Invalid audience' }, { status: 400 })
  }
  if (!inApp && !email) {
    return NextResponse.json({ error: 'Pick at least one channel (in-app or email)' }, { status: 400 })
  }
  if (!subject || !message) {
    return NextResponse.json({ error: 'Subject and message are required' }, { status: 400 })
  }
  if (audience === 'ORGS' && orgIds.length === 0) {
    return NextResponse.json({ error: 'Select at least one organization' }, { status: 400 })
  }
  if (audience === 'USERS' && userIds.length === 0) {
    return NextResponse.json({ error: 'Select at least one user' }, { status: 400 })
  }

  try {
    const result = await runBroadcast({
      audience,
      orgIds,
      userIds,
      channels: { inApp, email },
      subject,
      message,
      href,
    })
    if (result.recipients === 0) {
      return NextResponse.json({ error: 'No recipients matched that audience' }, { status: 400 })
    }
    return NextResponse.json({ success: true, ...result })
  } catch (error: any) {
    console.error('Broadcast failed:', error)
    return NextResponse.json({ error: error.message || 'Failed to send broadcast' }, { status: 500 })
  }
}
