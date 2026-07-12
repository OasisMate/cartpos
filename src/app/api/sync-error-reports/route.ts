import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db/prisma'
import { Prisma } from '@prisma/client'

const MAX_BYTES = 256 * 1024

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    const body = await request.json()
    const payload = body?.payload ?? body
    const serialized = JSON.stringify(payload)
    if (serialized.length > MAX_BYTES) {
      return NextResponse.json({ error: 'Report too large' }, { status: 413 })
    }
    // Stamp authoritative identity + deployed commit; do not trust client-supplied ids.
    const stamped = {
      ...payload,
      serverStamp: {
        userId: user.id,
        shopId: user.currentShopId || null,
        orgId: user.currentOrgId || null,
        commit: process.env.VERCEL_GIT_COMMIT_SHA || null,
        receivedAt: new Date().toISOString(),
      },
    }
    const report = await prisma.syncErrorReport.create({
      data: {
        userId: user.id,
        shopId: user.currentShopId || null,
        orgId: user.currentOrgId || null,
        payload: stamped,
      },
      select: { id: true },
    })
    return NextResponse.json({ id: report.id })
  } catch (error: any) {
    console.error('Create sync error report failed:', error)
    return NextResponse.json({ error: error.message || 'Failed to submit report' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== 'PLATFORM_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const statusParam = request.nextUrl.searchParams.get('status')
    const where: Prisma.SyncErrorReportWhereInput =
      statusParam === 'NEW' || statusParam === 'REVIEWED' ? { status: statusParam } : {}
    const reports = await prisma.syncErrorReport.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
    })
    return NextResponse.json({ reports })
  } catch (error: any) {
    console.error('List sync error reports failed:', error)
    return NextResponse.json({ error: error.message || 'Failed to list reports' }, { status: 500 })
  }
}
