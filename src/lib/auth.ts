import { SignJWT, jwtVerify } from 'jose'
import bcrypt from 'bcryptjs'
import { prisma } from './db/prisma'
import { cookies } from 'next/headers'
import { isDatabaseConnectionError } from './db/db-utils'
import { withRetry } from './db/connection-retry'
import { presetForType, readFeatureConfig, getShopUnits } from './domain/business-presets'
import { resolveBillingState } from './billing/subscription'
import { readTokenVersion, isSessionCurrent } from './auth/token-version'

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

/** The user fields a session cookie is built from. */
export type SessionUser = { id: string; email: string; role: string; tokenVersion: number }

async function writeSessionCookie(user: SessionUser, expiresAt: Date) {
  const session = await new SignJWT({
    userId: user.id,
    email: user.email,
    role: user.role,
    // Short claim name deliberately: this cookie rides on every single request.
    v: user.tokenVersion,
  })
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
 * Issues the session cookie.
 *
 * Takes the user row rather than loose fields so the tokenVersion cannot be left off by
 * accident: a session issued without one can never be revoked.
 */
export async function createSession(user: SessionUser, rememberMe: boolean = false) {
  // If remember me is checked, set expiration to 30 days, otherwise 7 days
  const expirationDays = rememberMe ? 30 : 7
  const expiresAt = new Date(Date.now() + expirationDays * 24 * 60 * 60 * 1000)
  await writeSessionCookie(user, expiresAt)
}

/**
 * Re-stamps the caller's OWN cookie with a new tokenVersion, keeping its original expiry.
 *
 * Used when a user changes their own password: the point is to sign out their other
 * devices, not the browser they are typing in. Keeping the expiry preserves their
 * "remember me" choice instead of silently cutting a 30-day session down to 7.
 */
export async function reissueSession(user: SessionUser) {
  const cookieStore = await cookies()
  const current = cookieStore.get('session')?.value
  let expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  if (current) {
    try {
      const { payload } = await jwtVerify(current, encodedKey, { algorithms: ['HS256'] })
      if (typeof payload.exp === 'number') expiresAt = new Date(payload.exp * 1000)
    } catch {
      // Unreadable cookie: fall back to a fresh window rather than failing a password
      // change that has already been written.
    }
  }
  await writeSessionCookie(user, expiresAt)
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
  tokenVersion: number
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
      // A claim, not a fact. Only meaningful once compared against the user row, which
      // getCurrentUser does. Anything reading a session without that comparison is
      // trusting a cookie that a password reset was supposed to have killed.
      tokenVersion: readTokenVersion(payload.v),
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
          // Explicit select (not include) so the hot auth path never loads heavy/secret
          // columns: the base64 profileImageUrl (~10-30KB) is fetched separately only by
          // /api/me for the sidebar; passwordHash / 2FA secrets / tokens stay out entirely.
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            cnic: true,
            isWhatsApp: true,
            role: true,
            twoFactorEnabled: true,
            // One integer on a query that already runs: this is what makes session
            // revocation free. See lib/auth/token-version.ts.
            tokenVersion: true,
            organizations: {
              include: {
                organization: {
                  include: {
                    // One extra join on a query that already runs, so the
                    // paywall never costs a round trip. See lib/billing.
                    subscription: { include: { plan: true } },
                  },
                },
              },
            },
            shops: {
              include: {
                shop: {
                  include: {
                    organization: {
                      select: {
                        isDemo: true,
                        billingExempt: true,
                        billingExemptNote: true,
                        // The resolver needs both: status to honour suspension,
                        // createdAt to derive a trial deadline when dates are missing.
                        status: true,
                        createdAt: true,
                        type: true,
                        // Managers and cashiers have no OrganizationUser row, so
                        // their billing state has to come via their shop's org.
                        subscription: { include: { plan: true } },
                      },
                    },
                    settings: {
                      select: {
                        enableQuotations: true,
                        enableServiceCharge: true,
                        enableDeliveryCharge: true,
                        enableUnitSplitting: true,
                        enableTradePricing: true,
                        featureConfig: true,
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

    // Revoked session: the password was reset or changed after this cookie was issued, so
    // the cookie is no longer proof of anything. Treated exactly like no session at all.
    if (!isSessionCurrent(session.tokenVersion, user.tokenVersion)) {
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
    const currentType = (currentShop as any)?.organization?.type
    const preset = presetForType(currentType)
    const batchExpiry = readFeatureConfig(currentSettings?.featureConfig).batchExpiry ?? preset.batchExpiry
    const features = {
      quotations: currentSettings?.enableQuotations ?? preset.enableQuotations,
      serviceCharge: currentSettings?.enableServiceCharge ?? preset.enableServiceCharge,
      deliveryCharge: currentSettings?.enableDeliveryCharge ?? preset.enableDeliveryCharge,
      unitSplitting: currentSettings?.enableUnitSplitting ?? preset.enableUnitSplitting,
      tradePricing: currentSettings?.enableTradePricing ?? preset.enableTradePricing,
      batchExpiry,
      units: getShopUnits(currentSettings?.featureConfig, currentType),
    }

    // Billing state for whichever org this user is acting in. Org admins have an
    // OrganizationUser row; managers and cashiers do not, so fall back to the
    // org that owns their current shop. resolveBillingState never throws and
    // returns full access whenever anything is missing.
    const billingOrg =
      (currentShop as any)?.organization ??
      organizations.find((o) => o.orgId === currentOrgId)?.organization ??
      organizations[0]?.organization ??
      null
    const billing = resolveBillingState(billingOrg)

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      cnic: user.cnic,
      isWhatsApp: user.isWhatsApp,
      // Not loaded on the hot path; /api/me fetches it for the sidebar avatar.
      profileImageUrl: null as string | null,
      role: user.role,
      twoFactorEnabled: user.twoFactorEnabled,
      organizations,
      currentOrgId,
      shops,
      currentShopId,
      features,
      // What their plan allows and whether writes are permitted right now.
      // See lib/billing/guards.ts for how routes consume this.
      billing,
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

