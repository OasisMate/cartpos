import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db/prisma'
import { Prisma } from '@prisma/client'
import { notifyPlatformAdmins } from '@/lib/domain/notifications'
import { sendEmail, generateSyncReportEmail } from '@/lib/email'

const MAX_BYTES = 256 * 1024

/** Sum the per-type pending counts in a diagnostics bundle. */
function pendingTotalOf(payload: any): number {
  const counts = payload?.counts
  if (!counts || typeof counts !== 'object') return 0
  return Object.values(counts).reduce((sum: number, n: any) => sum + Number(n || 0), 0)
}

/** First stored syncError across all record types in a diagnostics bundle. */
function firstErrorOf(payload: any): string {
  const records = payload?.records
  if (records && typeof records === 'object') {
    for (const arr of Object.values(records) as any[]) {
      const hit = (Array.isArray(arr) ? arr : []).find((r) => r?.syncError)
      if (hit) return String(hit.syncError)
    }
  }
  return '(no stored error)'
}

/**
 * Alert every platform admin (in-app notification + email) that a report arrived.
 * Never throws - alerting must not fail the report submission.
 */
async function alertPlatformAdmins(
  origin: string,
  labels: { shopId: string | null; shopName: string | null; reportedBy: string },
  payload: any
): Promise<void> {
  try {
    const pendingTotal = pendingTotalOf(payload)
    const firstError = firstErrorOf(payload)
    const reviewLink = `${origin}/admin/sync-reports`
    const shopLabel = labels.shopName || labels.shopId || '(unknown shop)'

    await notifyPlatformAdmins({
      type: 'SYNC_ERROR_REPORT',
      title: 'Sync problem reported',
      body: `${shopLabel}: ${pendingTotal} pending. ${firstError}`,
      href: '/admin/sync-reports',
    })

    const admins = await prisma.user.findMany({
      where: { role: 'PLATFORM_ADMIN' },
      select: { email: true },
    })
    await Promise.all(
      admins
        .filter((a) => a.email)
        .map((a) =>
          sendEmail({
            to: a.email,
            subject: `Cart POS: sync problem at ${shopLabel}`,
            html: generateSyncReportEmail({
              shopName: labels.shopName,
              shopId: labels.shopId,
              reportedBy: labels.reportedBy,
              pendingTotal,
              firstError,
              reviewLink,
            }),
          })
        )
    )
  } catch (error) {
    console.error('Failed to alert platform admins of sync report:', error)
  }
}

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
    // Resolve human-readable labels once, so the email and admin page show names, not raw ids.
    const shop = user.currentShopId
      ? await prisma.shop.findUnique({ where: { id: user.currentShopId }, select: { name: true } }).catch(() => null)
      : null
    const shopName = shop?.name || null
    const reportedBy = user.name || user.email || user.id

    // Stamp authoritative identity + deployed commit; do not trust client-supplied ids.
    const stamped = {
      ...payload,
      serverStamp: {
        userId: user.id,
        reportedBy,
        shopId: user.currentShopId || null,
        shopName,
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
    // Alert platform admins (in-app + email). Non-blocking: never fails the submission.
    await alertPlatformAdmins(
      new URL(request.url).origin,
      { shopId: user.currentShopId || null, shopName, reportedBy },
      payload
    )
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
