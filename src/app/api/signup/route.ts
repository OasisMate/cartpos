import { NextResponse } from 'next/server'
import type { ShopRole } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { hashPassword } from '@/lib/auth'
import { normalizePhone, normalizeCNIC, validatePhone, validateCNIC } from '@/lib/validation'
import { passwordPolicyError } from '@/lib/validation/password'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { withRetry } from '@/lib/db/connection-retry'
import { isDatabaseConnectionError } from '@/lib/db/db-utils'
import { issueVerificationEmail } from '@/lib/domain/email-verification'

export async function POST(request: Request) {
  try {
    // Throttle signups per IP to limit automated abuse.
    const ip = getClientIp(request)
    const limit = rateLimit(`signup:ip:${ip}`, 5, 60 * 60 * 1000)
    if (!limit.ok) {
      return NextResponse.json(
        { error: 'Too many sign-up attempts. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
      )
    }

    const body = await request.json()
    const {
      // User fields
      firstName,
      lastName,
      email,
      phone,
      cnic,
      isWhatsApp,
      password,
      // Organization fields
      organizationName,
      organizationType,
      legalName,
      city,
      addressLine1,
      addressLine2,
      ntn,
      strn,
      orgPhone,
    } = body || {}

    // Validate required fields
    if (!firstName || !lastName || !email || !phone || !password || !organizationName || !organizationType || !city) {
      return NextResponse.json(
        { error: 'Missing required fields. Please fill all required fields.' },
        { status: 400 }
      )
    }

    // Enforce password strength server-side (client validation can be bypassed)
    const pwError = passwordPolicyError(password)
    if (pwError) {
      return NextResponse.json({ error: pwError }, { status: 400 })
    }

    // Validate and normalize phone
    const normalizedPhone = normalizePhone(phone, 'PK')
    if (!normalizedPhone || !validatePhone(phone, 'PK')) {
      return NextResponse.json({ error: 'Invalid phone number format' }, { status: 400 })
    }

    // CNIC is optional. Validate + dedup only when provided.
    let normalizedCNIC: string | null = null
    if (cnic && String(cnic).trim() !== '') {
      normalizedCNIC = normalizeCNIC(cnic)
      if (!normalizedCNIC || !validateCNIC(cnic)) {
        return NextResponse.json({ error: 'Invalid CNIC format. CNIC must be 13 digits.' }, { status: 400 })
      }
    }

    // Check for existing user by email, phone, and (if given) CNIC
    const [existingEmail, existingPhone, existingCNIC] = await Promise.all([
      prisma.user.findUnique({ where: { email: email.toLowerCase() } }),
      prisma.user.findUnique({ where: { phone: normalizedPhone } }),
      normalizedCNIC
        ? prisma.user.findUnique({ where: { cnic: normalizedCNIC } })
        : Promise.resolve(null),
    ])

    if (existingEmail) {
      return NextResponse.json({ error: 'User with this email already exists' }, { status: 409 })
    }
    if (existingPhone) {
      return NextResponse.json({ error: 'User with this phone number already exists' }, { status: 409 })
    }
    if (existingCNIC) {
      return NextResponse.json({ error: 'User with this CNIC already exists' }, { status: 409 })
    }

    const hashed = await hashPassword(password)
    const contactName = `${firstName} ${lastName}`.trim()

    // Normalize org phone if provided, otherwise use contact phone
    const normalizedOrgPhone = orgPhone ? normalizePhone(orgPhone, 'PK') : normalizedPhone

    // Create user, organization, default shop, and link as ORG_ADMIN.
    // Wrapped in withRetry so a transient DB connection drop (P1001) retries
    // with backoff instead of failing the sign-up outright.
    const result = await withRetry(() => prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: contactName,
          email: email.toLowerCase(),
          phone: normalizedPhone,
          cnic: normalizedCNIC,
          isWhatsApp: Boolean(isWhatsApp),
          password: hashed,
          role: 'NORMAL',
        },
      })

      const org = await tx.organization.create({
        data: {
          name: organizationName,
          legalName: legalName || organizationName,
          type: organizationType,
          phone: normalizedOrgPhone,
          city,
          addressLine1: addressLine1 || null,
          addressLine2: addressLine2 || null,
          ntn: ntn || null,
          strn: strn || null,
          // Gated self-serve signup: public signups start PENDING and get NO access
          // until a platform admin approves them (vetting / smallest attack surface).
          // The other onboarding path is admin-created accounts, which are ACTIVE on
          // creation (already vetted by the admin who created them).
          status: 'PENDING',
          requestedBy: user.id,
        },
      })

      await tx.organizationUser.create({
        data: {
          userId: user.id,
          orgId: org.id,
          orgRole: 'ORG_ADMIN',
        },
      })

      // Create default shop with organization details
      const shop = await tx.shop.create({
        data: {
          orgId: org.id,
          name: organizationName,
          city,
          phone: normalizedOrgPhone,
          addressLine1: addressLine1 || null,
          addressLine2: addressLine2 || null,
        },
      })

      // Link user as shop owner
      await tx.userShop.create({
        data: {
          userId: user.id,
          shopId: shop.id,
          shopRole: 'STORE_MANAGER' as ShopRole,
        },
      })

      return { userId: user.id, orgId: org.id, shopId: shop.id }
    }))

    // Email the verification link. Account stays unverified (and hidden from the
    // admin approval queue) until the user confirms ownership of this address.
    await issueVerificationEmail({
      userId: result.userId,
      email: email.toLowerCase(),
      name: contactName,
      origin: new URL(request.url).origin,
    })

    return NextResponse.json({ ok: true, verifyEmail: true, ...result })
  } catch (e: any) {
    console.error('Signup error:', e)
    // Handle unique constraint violations
    if (e.code === 'P2002') {
      const field = e.meta?.target?.[0]
      if (field === 'email') {
        return NextResponse.json({ error: 'User with this email already exists' }, { status: 409 })
      }
      if (field === 'phone') {
        return NextResponse.json({ error: 'User with this phone number already exists' }, { status: 409 })
      }
      if (field === 'cnic') {
        return NextResponse.json({ error: 'User with this CNIC already exists' }, { status: 409 })
      }
    }
    // Distinguish a transient connectivity problem (after retries were exhausted)
    // from a genuine server error so the user knows it's worth trying again.
    if (isDatabaseConnectionError(e)) {
      return NextResponse.json(
        { error: 'Could not reach the server. Please check your connection and try again.' },
        { status: 503 }
      )
    }
    return NextResponse.json({ error: 'Signup failed. Please try again.' }, { status: 500 })
  }
}


