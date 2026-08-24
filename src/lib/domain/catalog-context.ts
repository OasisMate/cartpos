import { prisma } from '@/lib/db/prisma'

/**
 * The vertical a shop shops the catalog as. Its own OrganizationType, so a
 * pharmacy never has to scroll past kiryana snacks to find what it stocks.
 *
 * Cached in-process for a few minutes. This is read on every product create so
 * the catalog can be fed, and a shop's business type changes about never - it
 * takes an admin editing the organization. Paying a database round trip for it
 * on the shopkeeper's "Add Product" click is not worth the freshness.
 *
 * Serverless instances each keep their own copy, which is fine: the worst case
 * is a newly retyped org being filed under its old vertical for a few minutes.
 */
const TTL_MS = 5 * 60 * 1000
const cache = new Map<string, { vertical: string | null; at: number }>()

export async function verticalForShop(shopId: string): Promise<string | null> {
  const hit = cache.get(shopId)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.vertical

  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    select: { organization: { select: { type: true } } },
  })
  const vertical = shop?.organization.type ?? null

  // Unbounded growth is not a risk at this scale, but a stray loop shouldn't be
  // able to pin memory either.
  if (cache.size > 500) cache.clear()
  cache.set(shopId, { vertical, at: Date.now() })
  return vertical
}
