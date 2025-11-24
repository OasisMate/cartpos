import { SignJWT, jwtVerify } from 'jose'
import bcrypt from 'bcryptjs'
import { prisma } from './db/prisma'
import { cookies } from 'next/headers'
import { isDatabaseConnectionError } from './db/db-utils'
import { withRetry } from './db/connection-retry'

const secretKey = process.env.JWT_SECRET || 'your-secret-key-change-in-production'
const encodedKey = new TextEncoder().encode(secretKey)

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword)
}

export async function createSession(userId: string, email: string, role: string) {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

  const session = await new SignJWT({ userId, email, role })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(encodedKey)

  const cookieStore = await cookies()
  cookieStore.set('session', session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    expires: expiresAt,
    sameSite: 'lax',
    path: '/',
  })
}

export async function deleteSession() {
  const cookieStore = await cookies()
  cookieStore.delete('session')
}

export async function getSession(): Promise<{
  userId: string
  email: string
  role: string
} | null> {
  try {
    const cookieStore = await cookies()
    const session = cookieStore.get('session')?.value

    if (!session) {
      return null
    }

    const { payload } = await jwtVerify(session, encodedKey, {
      algorithms: ['HS256'],
    })

    return {
      userId: payload.userId as string,
      email: payload.email as string,
      role: payload.role as string,
    }
  } catch (error) {
    return null
  }
}

export async function getCurrentUser() {
  try {
    const session = await getSession()
    if (!session) {
      return null
    }

    // Use retry logic for database connection issues
    const user = await withRetry(
      () =>
        prisma.user.findUnique({
          where: { id: session.userId },
          include: {
            organizations: {
              include: {
                organization: true,
              },
            },
            shops: {
              include: {
                shop: true,
              },
            },
          },
        }),
      { maxRetries: 2, initialDelay: 200 }
    )

    if (!user) {
      return null
    }

    const organizations = user.organizations.map((ou) => ({
      orgId: ou.orgId,
      orgRole: ou.orgRole,
      organization: ou.organization,
    }))

    const shops = user.shops.map((us) => ({
      shopId: us.shopId,
      shopRole: us.shopRole,
      shop: us.shop,
    }))

    // Get current shop from cookie (or default to first shop)
    const cookieStore = await cookies()
    const currentOrgId =
      cookieStore.get('currentOrgId')?.value || organizations[0]?.orgId || null
    const currentShopId = cookieStore.get('currentShopId')?.value || shops[0]?.shopId || null

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      cnic: user.cnic,
      isWhatsApp: user.isWhatsApp,
      role: user.role,
      organizations,
      currentOrgId,
      shops,
      currentShopId,
    }
  } catch (error) {
    // Log database connection errors but don't crash
    if (isDatabaseConnectionError(error)) {
      console.error('Database connection error in getCurrentUser:', error)
      // Return null to trigger redirect to login
      return null
    }
    // Re-throw other errors
    throw error
  }
}

