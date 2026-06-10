import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getCurrentUser } from '@/lib/auth'

// Toggle the current user's opt-in login 2FA.
export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const enabled = Boolean(body?.enabled)

  await prisma.user.update({ where: { id: user.id }, data: { twoFactorEnabled: enabled } })
  return NextResponse.json({ twoFactorEnabled: enabled })
}
