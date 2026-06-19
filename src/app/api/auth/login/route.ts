import { NextRequest, NextResponse } from 'next/server'
import { randomInt } from 'crypto'
import { prisma } from '@/lib/db/prisma'
import { verifyPassword, createSession, createPreAuthToken } from '@/lib/auth'
import { sendEmail, generateLoginCodeEmail } from '@/lib/email'
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
    const ipLimit = await rateLimit(`login:ip:${ip}`, 40, FIFTEEN_MIN)
    const acctKey = `login:id:${String(identifier).toLowerCase()}`
    const acctLimit = await rateLimit(acctKey, 8, FIFTEEN_MIN)
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

    // Successful password - reset this account's failed-attempt counter.
    await clearRateLimit(acctKey)

    // Opt-in 2FA: don't create a session yet; email a code and return a
    // short-lived pre-auth token the client exchanges for a session.
    // EXCEPTION: demo-org accounts are shared and their code goes to a dead inbox, so 2FA
    // would lock everyone out. Never gate a demo login on 2FA (defensive — the toggle is
    // also blocked for demo users, but a flag set earlier/by DB must not brick the demo).
    let inDemoOrg = false
    if (user.twoFactorEnabled) {
      const demoOrg = await prisma.organization.findFirst({
        where: {
          isDemo: true,
          OR: [
            { users: { some: { userId: user.id } } },
            { shops: { some: { owners: { some: { userId: user.id } } } } },
          ],
        },
        select: { id: true },
      })
      inDemoOrg = Boolean(demoOrg)
    }
    if (user.twoFactorEnabled && !inDemoOrg) {
      const code = String(randomInt(100000, 1000000))
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000)
      await prisma.loginCode.updateMany({ where: { userId: user.id, used: false }, data: { used: true } })
      await prisma.loginCode.create({ data: { userId: user.id, code, expiresAt } })
      await sendEmail({
        to: user.email,
        subject: 'Your Cart POS sign-in code',
        html: generateLoginCodeEmail(code, user.name),
      })
      const preAuthToken = await createPreAuthToken(user.id)
      return NextResponse.json({ twoFactor: true, preAuthToken, email: user.email })
    }

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

