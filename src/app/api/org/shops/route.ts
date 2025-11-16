import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getCurrentUser } from '@/lib/auth'

function ensureOrgAdmin(user: any) {
  const isOrgAdmin = user?.organizations?.some(
    (o: any) => o.orgId === user.currentOrgId && o.orgRole === 'ORG_ADMIN'
  )
  if (!isOrgAdmin && user?.role !== 'PLATFORM_ADMIN') {
    throw new Error('FORBIDDEN')
  }
}

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    ensureOrgAdmin(user)
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const orgId = user.currentOrgId
  if (!orgId) return NextResponse.json({ shops: [] })

  const shops = await prisma.shop.findMany({
    where: { orgId },
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { products: true, customers: true, invoices: true } },
    },
  })

  return NextResponse.json({ shops })
}

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    ensureOrgAdmin(user)
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const name = body?.name as string | undefined
  const city = (body?.city as string | undefined) || null

  if (!name) {
    return NextResponse.json({ error: 'Shop name is required' }, { status: 400 })
  }
  if (!user.currentOrgId) {
    return NextResponse.json({ error: 'No organization selected' }, { status: 400 })
  }

  const shop = await prisma.shop.create({
    data: { name, city, orgId: user.currentOrgId },
  })

  await prisma.shopSettings.create({
    data: {
      shopId: shop.id,
      requireCostPriceForStockItems: false,
      requireBarcodeForProducts: false,
      allowCustomUnits: true,
      languageMode: 'EN_BILINGUAL',
    },
  })

  return NextResponse.json({ shop })
}


