/**
 * Grant or revoke free access for an organization.
 *
 * Free access means the resolver hands back full Business features with no
 * charge and no expiry, and the owner's plan picker is hidden. Unlike isDemo it
 * does not block writes: these are real shops we have chosen not to charge.
 */
import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db/prisma'
import { logActivity, ActivityActions, EntityTypes } from '@/lib/audit/activityLog'

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'PLATFORM_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const orgId = params.id
  if (!orgId) return NextResponse.json({ error: 'Missing organization id' }, { status: 400 })

  const body = await request.json().catch(() => ({}))
  const grant = body.grant === true
  const note = typeof body.note === 'string' && body.note.trim() ? body.note.trim().slice(0, 200) : null

  try {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { name: true, billingExempt: true },
    })
    if (!org) return NextResponse.json({ error: 'Organization not found' }, { status: 404 })

    const updated = await prisma.organization.update({
      where: { id: orgId },
      data: grant
        ? { billingExempt: true, billingExemptNote: note, billingExemptAt: new Date(), billingExemptBy: user.id }
        : { billingExempt: false, billingExemptNote: null, billingExemptAt: null, billingExemptBy: null },
      select: { id: true, name: true, billingExempt: true, billingExemptNote: true, billingExemptAt: true },
    })

    await logActivity({
      userId: user.id,
      orgId,
      action: grant ? ActivityActions.GRANT_FREE_ACCESS : ActivityActions.REVOKE_FREE_ACCESS,
      entityType: EntityTypes.ORGANIZATION,
      entityId: orgId,
      details: { name: updated.name, note },
      ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
      userAgent: request.headers.get('user-agent') || null,
    })

    return NextResponse.json({ organization: updated })
  } catch (error: any) {
    console.error('Free access toggle error:', error)
    return NextResponse.json({ error: 'Failed to update free access' }, { status: 500 })
  }
}
