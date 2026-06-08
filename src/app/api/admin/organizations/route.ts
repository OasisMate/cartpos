import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { listOrganizations, createOrganizationWithOwner } from '@/lib/domain/organizations'

export async function GET() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'PLATFORM_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const orgs = await listOrganizations()
  return NextResponse.json({ organizations: orgs })
}

// POST: platform admin creates a new organization + owner (ACTIVE immediately)
export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'PLATFORM_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const result = await createOrganizationWithOwner(body, user.id)
    return NextResponse.json({ ok: true, ...result })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to create organization' }, { status: 400 })
  }
}


