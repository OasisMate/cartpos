import { prisma } from '@/lib/db/prisma'
import { DEFAULT_TIMEZONE } from '@/lib/utils/timezone'

/** The shop's configured IANA timezone, falling back to the default. */
export async function getShopTimezone(shopId: string): Promise<string> {
  const settings = await prisma.shopSettings.findUnique({
    where: { shopId },
    select: { timezone: true },
  })
  return settings?.timezone || DEFAULT_TIMEZONE
}
