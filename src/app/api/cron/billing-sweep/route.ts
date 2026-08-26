/**
 * Daily sweep that brings stored subscription statuses in line with the date.
 *
 * Access is never decided here: resolveBillingState recomputes against the
 * current time on every request, so a late or missed run cannot lock anyone
 * out. This only keeps the admin list and its filters honest.
 *
 * Vercel Hobby allows one run per day and fires it at any minute inside the
 * scheduled hour, which is fine for a deadline measured in days.
 */
import { NextResponse } from 'next/server'
import { sweepSubscriptions } from '@/lib/billing/lifecycle'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 500 })
  }

  // Vercel signs its own cron calls with this header. A manual run can pass
  // the same bearer token by hand.
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await sweepSubscriptions()
    console.log('[cron/billing-sweep]', result)
    return NextResponse.json({ ok: true, ...result })
  } catch (error: any) {
    console.error('[cron/billing-sweep] failed:', error)
    return NextResponse.json({ error: error?.message || 'Sweep failed' }, { status: 500 })
  }
}
