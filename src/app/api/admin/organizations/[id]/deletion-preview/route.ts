import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getOrgDeletionPreview } from '@/lib/domain/organizations'

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'PLATFORM_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  try {
    const preview = await getOrgDeletionPreview(params.id)
    return NextResponse.json({ preview })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to load preview' }, { status: 400 })
  }
}
