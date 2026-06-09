import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { cancelOrgDeletion } from '@/lib/domain/organizations'
import { logActivity, ActivityActions, EntityTypes } from '@/lib/audit/activityLog'

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'PLATFORM_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const orgId = params.id
  try {
    const updated = await cancelOrgDeletion(orgId, user.id)
    await logActivity({
      userId: user.id,
      orgId,
      action: ActivityActions.CANCEL_ORG_DELETION,
      entityType: EntityTypes.ORGANIZATION,
      entityId: orgId,
      details: { name: updated.name },
      ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
      userAgent: request.headers.get('user-agent') || null,
    })
    return NextResponse.json({ organization: updated })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to cancel deletion' }, { status: 400 })
  }
}
