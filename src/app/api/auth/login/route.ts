import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { verifyPassword, createSession } from '@/lib/auth'
import { normalizePhone, normalizeCNIC, validatePhone } from '@/lib/validation'
import { withRetry } from '@/lib/db/connection-retry'
import { rateLimit, clearRateLimit, getClientIp } from '@/lib/rate-limit'

const FIFTEEN_MIN = 15 * 60 * 1000

function isDatabaseConnectionError(error: unknown): boolean {
  if (!error) return false
  
  const errorMessage = (error as Error)?.message || String(error)
  const errorName = (error as any)?.name || ''
  
  return (
    errorName === 'PrismaClientInitializationError' ||
    errorMessage.includes("Can't reach database server") ||
    errorMessage.includes("Can't reach") ||
    (errorMessage.includes('database') && errorMessage.includes('server'))
  )
}

export async function POST(request: NextRequest) {
  try {
    const { identifier, password, rememberMe } = await request.json()

    if (!identifier || !password) {
      return NextResponse.json(
        { error: 'Identifier and password are required' },
        { status: 400 }
      )
    }

    // Brute-force protection: coarse per-IP cap + per-account cap (cleared on success).
    const ip = getClientIp(request)
    const ipLimit = rateLimit(`login:ip:${ip}`, 40, FIFTEEN_MIN)
    const acctKey = `login:id:${String(identifier).toLowerCase()}`
    const acctLimit = rateLimit(acctKey, 8, FIFTEEN_MIN)
    if (!ipLimit.ok || !acctLimit.ok) {
      const retryAfter = Math.max(ipLimit.retryAfter, acctLimit.retryAfter)
      return NextResponse.json(
        { error: `Too many login attempts. Please try again in about ${Math.ceil(retryAfter / 60)} minute(s).` },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      )
    }

    let user = null

    try {
      // Try to identify user by phone (E.164), CNIC (digits), or email
      // Use retry logic for connection issues
      const normalizedPhone = normalizePhone(identifier, 'PK')
      if (normalizedPhone && validatePhone(identifier, 'PK')) {
        user = await withRetry(
          () => prisma.user.findUnique({ where: { phone: normalizedPhone } }),
          { maxRetries: 2, initialDelay: 200 }
        )
      }

      // If not found by phone, check CNIC
      if (!user) {
        const normalizedCNIC = normalizeCNIC(identifier)
        if (normalizedCNIC) {
          user = await withRetry(
            () => prisma.user.findUnique({ where: { cnic: normalizedCNIC } }),
            { maxRetries: 2, initialDelay: 200 }
          )
        }
      }

      // If still not found, treat as email
      if (!user) {
        user = await withRetry(
          () => prisma.user.findUnique({ where: { email: identifier.toLowerCase() } }),
          { maxRetries: 2, initialDelay: 200 }
        )
      }
    } catch (dbError) {
      // Check if it's a database connection error
      if (isDatabaseConnectionError(dbError)) {
        console.error('Database connection error:', dbError)
        return NextResponse.json(
          {
            error: 'Database connection failed. Please check your database configuration or try again later.',
            code: 'DATABASE_CONNECTION_ERROR',
          },
          { status: 503 }
        )
      }
      // Re-throw other database errors
      throw dbError
    }

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid identifier or password' },
        { status: 401 }
      )
    }

    // Verify password
    const isValidPassword = await verifyPassword(password, user.password)

    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Invalid identifier or password' },
        { status: 401 }
      )
    }

    // Block sign-in until the email address is confirmed (grandfathered users
    // are already verified, so only new unverified signups hit this).
    if (!user.emailVerified) {
      return NextResponse.json(
        {
          error: 'Please verify your email before signing in. Check your inbox for the verification link.',
          code: 'EMAIL_NOT_VERIFIED',
          email: user.email,
        },
        { status: 403 }
      )
    }

    // Successful login — reset this account's failed-attempt counter.
    clearRateLimit(acctKey)

    // Create session with remember me option
    await createSession(user.id, user.email, user.role, rememberMe)

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    })
  } catch (error) {
    console.error('Login error:', error)
    
    // Check if it's a database connection error that wasn't caught earlier
    if (isDatabaseConnectionError(error)) {
      return NextResponse.json(
        {
          error: 'Database connection failed. Please check your database configuration or try again later.',
          code: 'DATABASE_CONNECTION_ERROR',
        },
        { status: 503 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

