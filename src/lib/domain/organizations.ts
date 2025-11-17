import { prisma } from '@/lib/db/prisma'

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


