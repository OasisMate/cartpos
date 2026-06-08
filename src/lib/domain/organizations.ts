import type { ShopRole } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { hashPassword } from '@/lib/auth'
import { normalizePhone, normalizeCNIC, validatePhone, validateCNIC } from '@/lib/validation'

export interface CreateOrgByAdminInput {
  organizationName: string
  organizationType: string
  city: string
  legalName?: string
  orgPhone?: string
  addressLine1?: string
  addressLine2?: string
  ntn?: string
  strn?: string
  // Owner (org admin) account
  ownerName: string
  ownerEmail: string
  ownerPassword: string
  ownerPhone?: string
  ownerCnic?: string
}

/**
 * Admin-initiated onboarding: create a new organization that is ACTIVE immediately
 * (already vetted by the platform admin who created it), with its owner (ORG_ADMIN)
 * and a first shop. This is the second onboarding path alongside gated public signup.
 */
export async function createOrganizationWithOwner(
  input: CreateOrgByAdminInput,
  adminUserId: string
) {
  const {
    organizationName,
    organizationType,
    city,
    legalName,
    orgPhone,
    addressLine1,
    addressLine2,
    ntn,
    strn,
    ownerName,
    ownerEmail,
    ownerPassword,
    ownerPhone,
    ownerCnic,
  } = input

  if (!organizationName || !organizationType || !city || !ownerName || !ownerEmail || !ownerPassword) {
    throw new Error('Missing required fields: organization name, type, city, owner name, email, password')
  }
  if (ownerPassword.length < 8) {
    throw new Error('Owner password must be at least 8 characters')
  }

  // Optional phone/cnic — validate only if provided
  let normalizedPhone: string | null = null
  if (ownerPhone) {
    normalizedPhone = normalizePhone(ownerPhone, 'PK')
    if (!normalizedPhone || !validatePhone(ownerPhone, 'PK')) {
      throw new Error('Invalid owner phone number format')
    }
  }
  let normalizedCnic: string | null = null
  if (ownerCnic) {
    normalizedCnic = normalizeCNIC(ownerCnic)
    if (!normalizedCnic || !validateCNIC(ownerCnic)) {
      throw new Error('Invalid owner CNIC format. CNIC must be 13 digits.')
    }
  }

  const emailLower = ownerEmail.toLowerCase()
  const [existingEmail, existingPhone, existingCnic] = await Promise.all([
    prisma.user.findUnique({ where: { email: emailLower } }),
    normalizedPhone ? prisma.user.findUnique({ where: { phone: normalizedPhone } }) : Promise.resolve(null),
    normalizedCnic ? prisma.user.findUnique({ where: { cnic: normalizedCnic } }) : Promise.resolve(null),
  ])
  if (existingEmail) throw new Error('A user with this email already exists')
  if (existingPhone) throw new Error('A user with this phone number already exists')
  if (existingCnic) throw new Error('A user with this CNIC already exists')

  const hashed = await hashPassword(ownerPassword)
  const normalizedOrgPhone = orgPhone ? normalizePhone(orgPhone, 'PK') : normalizedPhone

  return prisma.$transaction(async (tx) => {
    const owner = await tx.user.create({
      data: {
        name: ownerName.trim(),
        email: emailLower,
        phone: normalizedPhone,
        cnic: normalizedCnic,
        password: hashed,
        role: 'NORMAL',
      },
    })

    const org = await tx.organization.create({
      data: {
        name: organizationName,
        legalName: legalName || organizationName,
        type: organizationType as any,
        phone: normalizedOrgPhone,
        city,
        addressLine1: addressLine1 || null,
        addressLine2: addressLine2 || null,
        ntn: ntn || null,
        strn: strn || null,
        // Admin-created orgs are ACTIVE immediately and recorded as approved by the admin.
        status: 'ACTIVE',
        requestedBy: adminUserId,
        approvedBy: adminUserId,
        approvedAt: new Date(),
      },
    })

    await tx.organizationUser.create({
      data: { userId: owner.id, orgId: org.id, orgRole: 'ORG_ADMIN' },
    })

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

    await tx.userShop.create({
      data: { userId: owner.id, shopId: shop.id, shopRole: 'STORE_MANAGER' as ShopRole },
    })

    return { orgId: org.id, ownerId: owner.id, shopId: shop.id }
  })
}

export async function listOrganizations() {
  const orgs = await prisma.organization.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: {
        select: { shops: true, users: true },
      },
    },
  })
  
  // Fetch requestedBy user details for each org
  const orgsWithUsers = await Promise.all(
    orgs.map(async (org) => {
      let requestedByUser = null
      if (org.requestedBy) {
        requestedByUser = await prisma.user.findUnique({
          where: { id: org.requestedBy },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            cnic: true,
            isWhatsApp: true,
          },
        })
      }
      return {
        ...org,
        requestedByUser,
      }
    })
  )
  
  return orgsWithUsers
}

export async function approveOrganization(orgId: string, adminUserId: string) {
  // Simple approval: set ACTIVE and approvedBy/approvedAt
  const updated = await prisma.organization.update({
    where: { id: orgId },
    data: {
      status: 'ACTIVE',
      approvedBy: adminUserId,
      approvedAt: new Date(),
      rejectionReason: null, // Clear any rejection reason
      suspensionReason: null, // Clear any suspension reason
    },
  })
  return updated
}

export async function rejectOrganization(orgId: string, adminUserId: string, reason?: string) {
  const updated = await prisma.organization.update({
    where: { id: orgId },
    data: {
      status: 'INACTIVE',
      rejectionReason: reason || null,
      suspensionReason: null, // Clear suspension reason if any
    },
  })
  return updated
}

export async function suspendOrganization(orgId: string, adminUserId: string, reason?: string) {
  const updated = await prisma.organization.update({
    where: { id: orgId },
    data: {
      status: 'SUSPENDED',
      suspensionReason: reason || null,
    },
  })
  return updated
}

export async function reactivateOrganization(orgId: string, adminUserId: string) {
  const updated = await prisma.organization.update({
    where: { id: orgId },
    data: {
      status: 'ACTIVE',
      suspensionReason: null, // Clear suspension reason
    },
  })
  return updated
}


