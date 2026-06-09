import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db/prisma'
import { purgeOrganization } from '@/lib/domain/organizations'

// Permanently delete a scheduled org after its buffer has elapsed.
// Body: { confirmName: string, deleteOwner?: boolean, deleteStaff?: boolean }
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'PLATFORM_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const orgId = params.id
  try {
    const body = await request.json().catch(() => ({}))
    const confirmName: string = (body.confirmName || '').trim()

    // Server-side type-to-confirm: the typed name must match exactly.
    const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { name: true } })
    if (!org) return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    if (confirmName !== org.name) {
      return NextResponse.json({ error: 'Confirmation text does not match the organization name' }, { status: 400 })
    }

    // Record who purged it (the org's own activity log is deleted with it, so
    // log to the server before the irreversible delete).
    console.warn(`[PURGE_ORG] admin=${user.id} org=${orgId} name="${org.name}" deleteOwner=${!!body.deleteOwner} deleteStaff=${!!body.deleteStaff}`)

    const result = await purgeOrganization(orgId, user.id, {
      deleteOwner: !!body.deleteOwner,
      deleteStaff: !!body.deleteStaff,
    })
    return NextResponse.json({ success: true, ...result })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to delete organization' }, { status: 400 })
  }
}
