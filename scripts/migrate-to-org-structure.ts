import { PrismaClient, UserRole, OrgStatus, OrgRole, ShopRole } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Create a default "Legacy" organization if none exists
  let legacyOrg = await prisma.organization.findFirst({
    where: { name: 'Legacy' },
  })
  if (!legacyOrg) {
    legacyOrg = await prisma.organization.create({
      data: {
        name: 'Legacy',
        type: 'OTHER',
        status: OrgStatus.ACTIVE,
      },
    })
    console.log('Created Legacy organization:', legacyOrg.id)
  }

  // Ensure all shops are linked to an organization (legacy)
  const shopsWithoutOrg = await prisma.shop.findMany({
    where: { orgId: undefined as unknown as string }, // will be set below via updateMany
  })
  if (shopsWithoutOrg.length > 0) {
    await prisma.shop.updateMany({
      data: { orgId: legacyOrg.id },
      where: { orgId: undefined as unknown as string },
    })
    console.log(`Linked ${shopsWithoutOrg.length} shops to Legacy organization`)
  }

  // Migrate user roles: ADMIN -> PLATFORM_ADMIN
  const updatedAdmins = await prisma.user.updateMany({
    data: { role: UserRole.PLATFORM_ADMIN },
    where: { role: 'ADMIN' as unknown as UserRole },
  })
  if (updatedAdmins.count > 0) {
    console.log(`Updated ${updatedAdmins.count} users to PLATFORM_ADMIN`)
  }

  // Migrate shop roles: OWNER -> STORE_MANAGER
  const updatedOwners = await prisma.userShop.updateMany({
    data: { shopRole: 'STORE_MANAGER' as ShopRole },
    where: { shopRole: 'SHOP_OWNER' as ShopRole },
  })
  if (updatedOwners.count > 0) {
    console.log(`Updated ${updatedOwners.count} user-shop roles to STORE_MANAGER`)
  }

  // Optionally, attach PLATFORM_ADMINs as ORG_ADMIN to Legacy org for convenience (view data)
  const platformAdmins = await prisma.user.findMany({
    where: { role: UserRole.PLATFORM_ADMIN },
    select: { id: true },
  })
  for (const admin of platformAdmins) {
    const exists = await prisma.organizationUser.findFirst({
      where: { userId: admin.id, orgId: legacyOrg.id },
    })
    if (!exists) {
      await prisma.organizationUser.create({
        data: {
          userId: admin.id,
          orgId: legacyOrg.id,
          orgRole: OrgRole.ORG_ADMIN,
        },
      })
      console.log(`Linked PLATFORM_ADMIN ${admin.id} to Legacy org as ORG_ADMIN`)
    }
  }
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })


