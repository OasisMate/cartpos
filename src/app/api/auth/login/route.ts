import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { verifyPassword, createSession } from '@/lib/auth'
import { normalizePhone, normalizeCNIC, validatePhone } from '@/lib/validation'

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

    // Try to identify user by phone (E.164), CNIC (digits), or email
    // First, check if it's a phone number
    const normalizedPhone = normalizePhone(identifier, 'PK')
    if (normalizedPhone && validatePhone(identifier, 'PK')) {
      user = await prisma.user.findUnique({
        where: { phone: normalizedPhone },
      })
    }

    // If not found by phone, check CNIC
    if (!user) {
      const normalizedCNIC = normalizeCNIC(identifier)
      if (normalizedCNIC) {
        user = await prisma.user.findUnique({
          where: { cnic: normalizedCNIC },
        })
      }
    }

    // If still not found, treat as email
    if (!user) {
      user = await prisma.user.findUnique({
        where: { email: identifier.toLowerCase() },
      })
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
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

