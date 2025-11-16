import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { approveOrganization } from '@/lib/domain/organizations'

export async function POST(
  _request: Request,
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
  return NextResponse.json({ organization: updated })
}


