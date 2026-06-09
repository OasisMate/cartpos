import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { approveOrganization } from '@/lib/domain/organizations'
import { logActivity, ActivityActions, EntityTypes } from '@/lib/audit/activityLog'

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

  const updated = await approveOrganization(orgId, user.id)

  await logActivity({
    userId: user.id,
    orgId,
    action: ActivityActions.APPROVE_ORG,
    entityType: EntityTypes.ORGANIZATION,
    entityId: orgId,
    details: { name: updated?.name },
    ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
    userAgent: request.headers.get('user-agent') || null,
  })

  return NextResponse.json({ organization: updated })
}


