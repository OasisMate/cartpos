import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { changeOrganizationType } from '@/lib/domain/organizations'
import { isBusinessType } from '@/lib/domain/business-types'
import { logActivity, ActivityActions, EntityTypes } from '@/lib/audit/activityLog'

/** Platform admin: reassign an org's business type (optionally re-seeding shop presets). */
export async function PATCH(
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

  const body = await request.json().catch(() => null)
  const type = body?.type
  if (!isBusinessType(type)) {
    return NextResponse.json({ error: 'Unknown business type' }, { status: 400 })
  }
  const reapplyPresets = Boolean(body?.reapplyPresets)

  try {
    const result = await changeOrganizationType(orgId, type, { reapplyPresets })

    await logActivity({
      userId: user.id,
      orgId,
      action: ActivityActions.UPDATE_ORG_TYPE,
      entityType: EntityTypes.ORGANIZATION,
      entityId: orgId,
      details: {
        name: result.organization.name,
        from: result.previousType,
        to: type,
        reapplyPresets,
        shopsUpdated: result.shopsUpdated,
      },
      ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
      userAgent: request.headers.get('user-agent') || null,
    })

    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Failed to change business type' },
      { status: 400 }
    )
  }
}
