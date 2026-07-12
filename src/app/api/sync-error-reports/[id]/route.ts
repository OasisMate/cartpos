import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db/prisma'

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== 'PLATFORM_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const body = await request.json()
    const status = body?.status
    if (status !== 'NEW' && status !== 'REVIEWED') {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }
    await prisma.syncErrorReport.update({ where: { id: params.id }, data: { status } })
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error('Update sync error report failed:', error)
    return NextResponse.json({ error: error.message || 'Failed to update report' }, { status: 500 })
  }
}
