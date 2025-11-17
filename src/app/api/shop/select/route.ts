import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { cookies } from 'next/headers'
import { getUserShops } from '@/lib/domain/shops'

// POST: Select a shop (set currentShopId)
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()

    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await request.json()
    const { shopId } = body

    if (!shopId) {
      return NextResponse.json({ error: 'shopId is required' }, { status: 400 })
    }

    // Verify user has access to this shop
    // For Org Admins, check if shop belongs to their organization
    // For others, check if they have direct shop access
    const { prisma } = await import('@/lib/db/prisma')
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      include: {
        organizations: {
          where: {
            orgRole: 'ORG_ADMIN',
          },
        },
      },
    })

    let hasAccess = false

    if (user?.role === 'PLATFORM_ADMIN') {
      // Platform admin can access any shop
      hasAccess = true
    } else if (user?.organizations && user.organizations.length > 0) {
      // Check if shop belongs to user's organization
      const shop = await prisma.shop.findUnique({
        where: { id: shopId },
        select: { orgId: true },
      })
      const userOrgIds = user.organizations.map((o: any) => o.orgId)
      hasAccess = shop ? userOrgIds.includes(shop.orgId) : false
    } else {
      // Check direct shop access
      const userShops = await getUserShops(session.userId)
      hasAccess = userShops.some((us) => us.shopId === shopId)
    }

    if (!hasAccess) {
      return NextResponse.json(
        { error: 'You do not have access to this store' },
        { status: 403 }
      )
    }

    // Set current shop in cookie
    const cookieStore = await cookies()
    cookieStore.set('currentShopId', shopId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    })

    return NextResponse.json({ success: true, shopId })
  } catch (error: any) {
    console.error('Select shop error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to select shop' },
      { status: 500 }
    )
  }
}

