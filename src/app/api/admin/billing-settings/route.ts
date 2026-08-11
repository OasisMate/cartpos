import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db/prisma'
import { getBillingSettings } from '@/lib/billing/service'

/**
 * Platform admin: where shops send money.
 *
 * Kept in the database rather than env vars so bank or wallet details can be
 * corrected from the UI without a deploy, which matters when a wrong account
 * number means payments go astray.
 */

async function requireAdmin() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'PLATFORM_ADMIN') return null
  return user
}

export async function GET() {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return NextResponse.json({ settings: await getBillingSettings() })
}

const FIELDS = [
  'bankName',
  'accountTitle',
  'accountNumber',
  'iban',
  'raastId',
  'jazzcashNumber',
  'easypaisaNumber',
  'whatsappNumber',
  'supportEmail',
  'instructions',
] as const

export async function PUT(request: Request) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  const data: Record<string, string | null> = {}
  for (const field of FIELDS) {
    if (body[field] !== undefined) {
      const value = String(body[field] ?? '').trim()
      data[field] = value ? value.slice(0, field === 'instructions' ? 1000 : 120) : null
    }
  }

  const settings = await prisma.billingSettings.upsert({
    where: { id: 'default' },
    create: { id: 'default', ...data, updatedBy: user.id },
    update: { ...data, updatedBy: user.id },
  })

  // Not written to ActivityLog: that table requires an orgId FK and these are
  // platform-wide settings belonging to no organization. Attribution lives on
  // the row itself (updatedBy / updatedAt). Field names only in the log line,
  // never the account numbers themselves.
  console.info(`[billing] settings updated by ${user.email}: ${Object.keys(data).join(', ')}`)

  return NextResponse.json({ settings })
}
