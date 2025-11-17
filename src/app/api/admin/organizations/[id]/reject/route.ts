import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { rejectOrganization } from '@/lib/domain/organizations'

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'PLATFORM_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const orgId = params.id
  if (!orgId) {
    return NextResponse.json({ error: 'Missing organization id' }, { status: 400 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const reason = body.reason || undefined

    const updated = await rejectOrganization(orgId, user.id, reason)
    return NextResponse.json({ organization: updated })
  } catch (error: any) {
    console.error('Reject organization error:', error)
    return NextResponse.json({ error: 'Failed to reject organization' }, { status: 500 })
  }
}

