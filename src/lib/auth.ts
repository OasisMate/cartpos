import { SignJWT, jwtVerify } from 'jose'
import bcrypt from 'bcryptjs'
import { prisma } from './db/prisma'
import { cookies } from 'next/headers'
import { isDatabaseConnectionError } from './db/db-utils'
import { withRetry } from './db/connection-retry'
import { presetForType } from './domain/business-presets'

const secretKey = process.env.JWT_SECRET
if (!secretKey || secretKey.length < 32) {
  throw new Error(
    'JWT_SECRET must be set to a strong value (at least 32 characters). Refusing to start with an insecure fallback.'
  )
}
const encodedKey = new TextEncoder().encode(secretKey)

export async function hashPassword(password: string): Promise<string> {
  // Cost factor 12 (was 10) - stronger against offline cracking; ~250ms/hash is acceptable.
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword)
}

export async function createSession(userId: string, email: string, role: string, rememberMe: boolean = false) {
  // If remember me is checked, set expiration to 30 days, otherwise 7 days
  const expirationDays = rememberMe ? 30 : 7
  const expiresAt = new Date(Date.now() + expirationDays * 24 * 60 * 60 * 1000)

  const session = await new SignJWT({ userId, email, role })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(encodedKey)

  const cookieStore = await cookies()
  cookieStore.set('session', session, {
    httpOnly: true,
    // Secure everywhere except local dev (localhost is plain HTTP); staging/prod must use HTTPS.
    secure: process.env.NODE_ENV !== 'development',
    expires: expiresAt,
    sameSite: 'lax',
    path: '/',
  })
}

/**
 * Short-lived token proving the password step passed, pending a 2FA code.
 * Not a session - cannot access anything; only used to complete login.
 */
export async function createPreAuthToken(userId: string): Promise<string> {
  return new SignJWT({ userId, pending2fa: true })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(new Date(Date.now() + 10 * 60 * 1000)) // 10 minutes
    .sign(encodedKey)
}

export async function verifyPreAuthToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, encodedKey, { algorithms: ['HS256'] })
    if (payload.pending2fa !== true || !payload.userId) return null
    return payload.userId as string
  } catch {
    return null
  }
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
                shop: {
                  include: {
                    organization: { select: { isDemo: true, type: true } },
                    settings: {
                      select: {
                        enableQuotations: true,
                        enableServiceCharge: true,
                        enableDeliveryCharge: true,
                        enableUnitSplitting: true,
                      },
                    },
                  },
                },
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

    // Feature flags for the current shop, used to gate UI for ALL roles (cashiers
    // included, who can't read the settings endpoint). Falls back to the org-type
    // preset if a settings row doesn't exist yet.
    const currentShop = shops.find((s) => s.shopId === currentShopId)?.shop
    const currentSettings = (currentShop as any)?.settings
    const preset = presetForType((currentShop as any)?.organization?.type)
    const features = {
      quotations: currentSettings?.enableQuotations ?? preset.enableQuotations,
      serviceCharge: currentSettings?.enableServiceCharge ?? preset.enableServiceCharge,
      deliveryCharge: currentSettings?.enableDeliveryCharge ?? preset.enableDeliveryCharge,
      unitSplitting: currentSettings?.enableUnitSplitting ?? preset.enableUnitSplitting,
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      cnic: user.cnic,
      isWhatsApp: user.isWhatsApp,
      role: user.role,
      twoFactorEnabled: user.twoFactorEnabled,
      organizations,
      currentOrgId,
      shops,
      currentShopId,
      features,
      // True when the current org is a demo/test fixture → destructive actions blocked (see lib/demo.ts).
      // Store managers / cashiers have no OrganizationUser row, so derive demo status from the
      // current SHOP's org (their actual context); fall back to org membership for org admins.
      isDemoOrg:
        shops.find((s) => s.shopId === currentShopId)?.shop?.organization?.isDemo ??
        organizations.find((o) => o.orgId === currentOrgId)?.organization?.isDemo ??
        false,
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

