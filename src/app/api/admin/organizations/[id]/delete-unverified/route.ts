import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { purgeUnverifiedOrganization } from '@/lib/domain/organizations'

// Platform admin permanently removes an unverified signup (org + owner + data).
// Guarded in the domain layer: refuses if the owner is verified or the org is ACTIVE.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const admin = await getCurrentUser()
  if (!admin || admin.role !== 'PLATFORM_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  try {
    const result = await purgeUnverifiedOrganization(params.id, admin.id)
    return NextResponse.json({ success: true, ...result })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to delete organization' }, { status: 400 })
  }
}
