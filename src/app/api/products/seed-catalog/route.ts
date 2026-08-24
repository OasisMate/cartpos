import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { DemoBlockedResponse } from '@/lib/demo'
import { prisma } from '@/lib/db/prisma'
import { importProducts } from '@/lib/domain/product-import'
import { catalogForOrgType } from '@/lib/domain/starter-catalog'

/**
 * Starter catalog for a brand-new shop. GET reports what's on offer for this
 * shop's vertical; POST loads it. Seeding is only allowed while the shop is
 * still empty, so this can't quietly bulk-insert over a catalog someone has
 * already curated. Once there are products, the CSV import is the right tool.
 */
async function resolve(shopId: string) {
  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    select: {
      organization: { select: { type: true } },
      _count: { select: { products: true } },
    },
  })
  if (!shop) return null
  return { catalog: catalogForOrgType(shop.organization.type), productCount: shop._count.products }
}

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    if (!user.currentShopId) return NextResponse.json({ error: 'No shop selected' }, { status: 400 })

    const resolved = await resolve(user.currentShopId)
    if (!resolved?.catalog) return NextResponse.json({ available: false })

    return NextResponse.json({
      available: resolved.productCount === 0,
      slug: resolved.catalog.slug,
      label: resolved.catalog.label,
      count: resolved.catalog.rows.length,
    })
  } catch {
    return NextResponse.json({ available: false })
  }
}

export async function POST() {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    if (!user.currentShopId) return NextResponse.json({ error: 'No shop selected' }, { status: 400 })
    if (user.isDemoOrg) return DemoBlockedResponse()

    const resolved = await resolve(user.currentShopId)
    if (!resolved?.catalog) {
      return NextResponse.json({ error: 'No starter catalog for this shop type' }, { status: 404 })
    }
    if (resolved.productCount > 0) {
      return NextResponse.json(
        { error: 'This shop already has products. Use CSV import to add more.' },
        { status: 400 }
      )
    }

    const result = await importProducts(user.currentShopId, resolved.catalog.rows, user.id)
    return NextResponse.json({ success: true, label: resolved.catalog.label, ...result })
  } catch (error: any) {
    const msg = error?.message || 'Failed to load starter catalog'
    const status = /permission/i.test(msg) ? 403 : 400
    return NextResponse.json({ error: msg }, { status })
  }
}
