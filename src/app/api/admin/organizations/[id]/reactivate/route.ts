import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { reactivateOrganization } from '@/lib/domain/organizations'
import { logActivity, ActivityActions, EntityTypes } from '@/lib/audit/activityLog'
import { notifyOrgAdmins } from '@/lib/domain/notifications'

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
    const updated = await reactivateOrganization(orgId, user.id)

    await logActivity({
      userId: user.id,
      orgId,
      action: ActivityActions.REACTIVATE_ORG,
      entityType: EntityTypes.ORGANIZATION,
      entityId: orgId,
      details: { name: updated?.name },
      ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
      userAgent: request.headers.get('user-agent') || null,
    })

    await notifyOrgAdmins(orgId, {
      type: 'ORG_REACTIVATED',
      title: 'Your account is active again ✅',
      body: 'Your organization has been reactivated. Welcome back!',
      href: '/',
    })

    return NextResponse.json({ organization: updated })
  } catch (error: any) {
    console.error('Reactivate organization error:', error)
    return NextResponse.json({ error: 'Failed to reactivate organization' }, { status: 500 })
  }
}

