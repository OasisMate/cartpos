import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { verifyPreAuthToken, createSession } from '@/lib/auth'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

const FIFTEEN_MIN = 15 * 60 * 1000

// Second step of an opt-in 2FA login: exchange a pre-auth token + emailed code
// for a real session.
export async function POST(request: NextRequest) {
  try {
    const { preAuthToken, code, rememberMe } = await request.json()
    if (!preAuthToken || !code) {
      return NextResponse.json({ error: 'Code is required' }, { status: 400 })
    }

    const userId = await verifyPreAuthToken(preAuthToken)
    if (!userId) {
      return NextResponse.json({ error: 'Your session expired. Please sign in again.' }, { status: 401 })
    }

    // Throttle code attempts.
    const ip = getClientIp(request)
    const ipLimit = rateLimit(`2fa:ip:${ip}`, 20, FIFTEEN_MIN)
    const userLimit = rateLimit(`2fa:user:${userId}`, 8, FIFTEEN_MIN)
    if (!ipLimit.ok || !userLimit.ok) {
      return NextResponse.json({ error: 'Too many attempts. Please try again later.' }, { status: 429 })
    }

    const record = await prisma.loginCode.findFirst({
      where: { userId, used: false },
      orderBy: { createdAt: 'desc' },
    })
    if (!record || record.code !== String(code)) {
      return NextResponse.json({ error: 'Invalid code. Please check and try again.' }, { status: 400 })
    }
    if (record.expiresAt < new Date()) {
      return NextResponse.json({ error: 'This code has expired. Please sign in again.' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) {
      return NextResponse.json({ error: 'Account not found' }, { status: 401 })
    }

    await prisma.loginCode.update({ where: { id: record.id }, data: { used: true } })
    await createSession(user.id, user.email, user.role, Boolean(rememberMe))

    return NextResponse.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    })
  } catch (error) {
    console.error('2FA verify error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
