import { NextRequest, NextResponse } from 'next/server'
import { verifyEmailToken, verifyEmailCode } from '@/lib/domain/email-verification'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

const FIFTEEN_MIN = 15 * 60 * 1000

export async function POST(request: NextRequest) {
  try {
    const { token, email, code } = await request.json()

    // Link path: verify by opaque token.
    if (token && typeof token === 'string') {
      const result = await verifyEmailToken(token, request.nextUrl.origin)
      const ok = result.status === 'verified' || result.status === 'already'
      return NextResponse.json(result, { status: ok ? 200 : 400 })
    }

    // Code path: verify by email + 6-digit code (throttled against brute force).
    if (email && code) {
      const ip = getClientIp(request)
      const ipLimit = await rateLimit(`verify-code:ip:${ip}`, 20, FIFTEEN_MIN)
      const emailLimit = await rateLimit(`verify-code:email:${String(email).toLowerCase()}`, 8, FIFTEEN_MIN)
      if (!ipLimit.ok || !emailLimit.ok) {
        return NextResponse.json(
          { status: 'invalid', error: 'Too many attempts. Please wait a few minutes and try again.' },
          { status: 429 }
        )
      }
      const result = await verifyEmailCode(String(email), String(code), request.nextUrl.origin)
      const ok = result.status === 'verified' || result.status === 'already'
      return NextResponse.json(result, { status: ok ? 200 : 400 })
    }

    return NextResponse.json({ status: 'invalid' }, { status: 400 })
  } catch (error) {
    console.error('Verify email error:', error)
    return NextResponse.json({ status: 'invalid' }, { status: 500 })
  }
}
