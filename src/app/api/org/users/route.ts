import { NextResponse } from 'next/server'
import type { ShopRole } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { getCurrentUser, hashPassword } from '@/lib/auth'
import { logActivity, ActivityActions, EntityTypes } from '@/lib/audit/activityLog'
import { normalizePhone, normalizeCNIC, validatePhone, validateCNIC } from '@/lib/validation'
import { canManageOrgUsers, UnauthorizedResponse, ForbiddenResponse } from '@/lib/permissions'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return UnauthorizedResponse()
  
  const orgId = user.currentOrgId
  if (!orgId) return NextResponse.json({ users: [] })

  // Check permission
  if (!canManageOrgUsers(user, orgId)) {
    return ForbiddenResponse('Only Org Admins can manage organization users')
  }

  const orgUsers = await prisma.organizationUser.findMany({
    where: { orgId },
    include: {
      user: {
        select: { id: true, name: true, email: true, phone: true, cnic: true, role: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  const userIds = orgUsers.map((ou) => ou.userId)
  const userShops = await prisma.userShop.findMany({
    where: { userId: { in: userIds } },
    include: {
      shop: { select: { id: true, name: true } },
    },
  })

  const users = orgUsers.map((ou) => ({
    id: ou.user.id,
    name: ou.user.name,
    email: ou.user.email,
    phone: ou.user.phone,
    cnic: ou.user.cnic,
    platformRole: ou.user.role,
    orgRole: ou.orgRole,
    shops: userShops
      .filter((us) => us.userId === ou.userId)
      .map((us) => ({ shopId: us.shopId, shopRole: us.shopRole, shop: us.shop })),
  }))

  return NextResponse.json({ users })
}

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const orgId = user.currentOrgId
  if (!orgId) {
    return NextResponse.json({ error: 'No organization selected' }, { status: 400 })
  }

  // Check permission
  if (!canManageOrgUsers(user, orgId)) {
    return ForbiddenResponse('Only Org Admins can create organization users')
  }

  const body = await request.json().catch(() => null)
  const name = body?.name as string | undefined
  const email = body?.email as string | undefined
  const phone = body?.phone as string | undefined
  const cnic = body?.cnic as string | undefined
  const password = body?.password as string | undefined
  const orgRole = (body?.orgRole as 'ORG_ADMIN' | undefined) || undefined
  const assignments =
    (body?.assignments as Array<{ shopId: string; shopRole: ShopRole }> | undefined) || []

  if (!name || !email || !password) {
    return NextResponse.json({ error: 'Missing required fields: name, email, password' }, { status: 400 })
  }

  // Validate phone if provided
  let normalizedPhone: string | null = null
  if (phone) {
    normalizedPhone = normalizePhone(phone, 'PK')
    if (!normalizedPhone || !validatePhone(phone, 'PK')) {
      return NextResponse.json({ error: 'Invalid phone number format' }, { status: 400 })
    }
  }

  // Validate CNIC if provided
  let normalizedCNIC: string | null = null
  if (cnic) {
    normalizedCNIC = normalizeCNIC(cnic)
    if (!normalizedCNIC || !validateCNIC(cnic)) {
      return NextResponse.json({ error: 'Invalid CNIC format. CNIC must be 13 digits.' }, { status: 400 })
    }
  }

  // Check for existing user
  const [existingEmail, existingPhone, existingCNIC] = await Promise.all([
    prisma.user.findUnique({ where: { email: email.toLowerCase() } }),
    normalizedPhone ? prisma.user.findUnique({ where: { phone: normalizedPhone } }) : null,
    normalizedCNIC ? prisma.user.findUnique({ where: { cnic: normalizedCNIC } }) : null,
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

  const result = await prisma.$transaction(async (tx) => {
    const newUser = await tx.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        phone: normalizedPhone,
        cnic: normalizedCNIC,
        password: hashed,
        role: 'NORMAL',
        isWhatsApp: false,
      },
    })

    await tx.organizationUser.create({
      data: {
        userId: newUser.id,
        orgId: user.currentOrgId!,
        orgRole: orgRole || 'ORG_ADMIN',
      },
    })

    if (assignments.length > 0) {
      for (const a of assignments) {
        await tx.userShop.create({
          data: { userId: newUser.id, shopId: a.shopId, shopRole: a.shopRole },
        })
      }
    }

    return newUser
  })

  // Log activity
  await logActivity({
    userId: user.id,
    orgId,
    shopId: null,
    action: ActivityActions.CREATE_USER,
    entityType: EntityTypes.USER,
    entityId: result.id,
    details: {
      name: result.name,
      email: result.email,
      orgRole: orgRole || 'ORG_ADMIN',
      assignments: assignments.map((a) => ({ shopId: a.shopId, shopRole: a.shopRole })),
    },
  })

  return NextResponse.json({ user: { id: result.id } })
}


