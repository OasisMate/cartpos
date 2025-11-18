import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db/prisma'

interface RouteParams {
  params: { id: string }
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const shop = await prisma.shop.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        name: true,
        orgId: true,
        city: true,
      },
    })

    if (!shop) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const isPlatformAdmin = user.role === 'PLATFORM_ADMIN'
    const isOrgAdmin = user.organizations?.some((o: any) => o.orgId === shop.orgId)
    const hasShopAccess = user.shops?.some((s: any) => s.shopId === shop.id)

    if (!isPlatformAdmin && !isOrgAdmin && !hasShopAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json({ shop })
  } catch (error) {
    console.error('Admin shop fetch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

