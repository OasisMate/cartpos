import { NextResponse } from 'next/server'
import type { ShopRole } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { hashPassword } from '@/lib/auth'
import { normalizePhone, normalizeCNIC, validatePhone, validateCNIC } from '@/lib/validation'

export async function POST(request: Request) {
  try {
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
    if (!firstName || !lastName || !email || !phone || !cnic || !password || !organizationName || !organizationType || !city) {
      return NextResponse.json(
        { error: 'Missing required fields. Please fill all required fields.' },
        { status: 400 }
      )
    }

    // Validate and normalize phone
    const normalizedPhone = normalizePhone(phone, 'PK')
    if (!normalizedPhone || !validatePhone(phone, 'PK')) {
      return NextResponse.json({ error: 'Invalid phone number format' }, { status: 400 })
    }

    // Validate and normalize CNIC
    const normalizedCNIC = normalizeCNIC(cnic)
    if (!normalizedCNIC || !validateCNIC(cnic)) {
      return NextResponse.json({ error: 'Invalid CNIC format. CNIC must be 13 digits.' }, { status: 400 })
    }

    // Check for existing user by email, phone, or CNIC
    const [existingEmail, existingPhone, existingCNIC] = await Promise.all([
      prisma.user.findUnique({ where: { email: email.toLowerCase() } }),
      prisma.user.findUnique({ where: { phone: normalizedPhone } }),
      prisma.user.findUnique({ where: { cnic: normalizedCNIC } }),
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

    // Create user, organization, default shop, and link as ORG_ADMIN
    const result = await prisma.$transaction(async (tx) => {
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
    })

    return NextResponse.json({ ok: true, ...result })
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
    return NextResponse.json({ error: 'Signup failed. Please try again.' }, { status: 500 })
  }
}


