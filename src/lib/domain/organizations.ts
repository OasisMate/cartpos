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
  return orgs
}

export async function approveOrganization(orgId: string, adminUserId: string) {
  // Simple approval: set ACTIVE and approvedBy/approvedAt
  const updated = await prisma.organization.update({
    where: { id: orgId },
    data: {
      status: 'ACTIVE',
      approvedBy: adminUserId,
      approvedAt: new Date(),
    },
  })
  return updated
}


