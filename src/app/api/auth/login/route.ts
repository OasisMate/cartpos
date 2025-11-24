import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { verifyPassword, createSession } from '@/lib/auth'
import { normalizePhone, normalizeCNIC, validatePhone } from '@/lib/validation'
import { withRetry } from '@/lib/db/connection-retry'

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
    const { identifier, password } = await request.json()

    if (!identifier || !password) {
      return NextResponse.json(
        { error: 'Identifier and password are required' },
        { status: 400 }
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

    // Create session
    await createSession(user.id, user.email, user.role)

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

