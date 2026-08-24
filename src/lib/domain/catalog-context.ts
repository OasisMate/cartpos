import { prisma } from '@/lib/db/prisma'

/**
 * The vertical a shop shops the catalog as. Its own OrganizationType, so a
 * pharmacy never has to scroll past kiryana snacks to find what it stocks.
 */
export async function verticalForShop(shopId: string): Promise<string | null> {
  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    select: { organization: { select: { type: true } } },
  })
  return shop?.organization.type ?? null
}
