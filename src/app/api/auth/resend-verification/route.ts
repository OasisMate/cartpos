import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { issueVerificationEmail } from '@/lib/domain/email-verification'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

const ONE_HOUR = 60 * 60 * 1000

// Generic reply so we never reveal whether an email exists or its verified state.
const GENERIC = { message: 'If that account exists and needs verification, a new link has been sent.' }

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    // Throttle to prevent inbox flooding / probing.
    const ip = getClientIp(request)
    const ipLimit = rateLimit(`verify-resend:ip:${ip}`, 5, ONE_HOUR)
    const emailLimit = rateLimit(`verify-resend:email:${email.toLowerCase()}`, 3, ONE_HOUR)
    if (!ipLimit.ok || !emailLimit.ok) {
      return NextResponse.json(GENERIC)
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, email: true, name: true, emailVerified: true },
    })

    // Only send if the user exists and still needs verification.
    if (user && !user.emailVerified) {
      await issueVerificationEmail({
        userId: user.id,
        email: user.email,
        name: user.name,
        origin: request.nextUrl.origin,
      })
    }

    return NextResponse.json(GENERIC)
  } catch (error) {
    console.error('Resend verification error:', error)
    return NextResponse.json(GENERIC)
  }
}
