import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { listOrganizations } from '@/lib/domain/organizations'

export async function GET() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'PLATFORM_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const orgs = await listOrganizations()
  return NextResponse.json({ organizations: orgs })
}


