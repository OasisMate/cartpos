import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getCurrentUser } from '@/lib/auth'
import { logActivity, ActivityActions, EntityTypes } from '@/lib/audit/activityLog'

function ensureOrgAdmin(user: any) {
  const isOrgAdmin = user?.organizations?.some(
    (o: any) => o.orgId === user.currentOrgId && o.orgRole === 'ORG_ADMIN'
  )
  if (!isOrgAdmin && user?.role !== 'PLATFORM_ADMIN') {
    throw new Error('FORBIDDEN')
  }
}

// POST: Assign user to store with role
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  
  try {
    ensureOrgAdmin(user)
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const userId = params.id
  const orgId = user.currentOrgId

  if (!orgId) {
    return NextResponse.json({ error: 'No organization selected' }, { status: 400 })
  }

  try {
    const body = await request.json()
    const { shopId, shopRole } = body

    if (!shopId || !shopRole) {
      return NextResponse.json(
        { error: 'shopId and shopRole are required' },
        { status: 400 }
      )
    }

    if (!['STORE_MANAGER', 'CASHIER'].includes(shopRole)) {
      return NextResponse.json(
        { error: 'Invalid shopRole. Must be STORE_MANAGER or CASHIER' },
        { status: 400 }
      )
    }

    // Verify user belongs to organization
    const orgUser = await prisma.organizationUser.findFirst({
      where: {
        userId,
        orgId,
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    })

    if (!orgUser) {
      return NextResponse.json({ error: 'User not found in organization' }, { status: 404 })
    }

    // Verify shop belongs to organization
    const shop = await prisma.shop.findFirst({
      where: {
        id: shopId,
        orgId,
      },
      select: {
        id: true,
        name: true,
      },
    })

    if (!shop) {
      return NextResponse.json({ error: 'Store not found in organization' }, { status: 404 })
    }

    // Check if assignment already exists
    const existingAssignment = await prisma.userShop.findUnique({
      where: {
        userId_shopId: {
          userId,
          shopId,
        },
      },
    })

    if (existingAssignment) {
      // Update existing assignment
      await prisma.userShop.update({
        where: {
          userId_shopId: {
            userId,
            shopId,
          },
        },
        data: { shopRole },
      })
    } else {
      // Create new assignment
      await prisma.userShop.create({
        data: {
          userId,
          shopId,
          shopRole,
        },
      })
    }

    // Log activity
    await logActivity({
      userId: user.id,
      orgId,
      shopId,
      action: ActivityActions.ASSIGN_STORE,
      entityType: EntityTypes.USER,
      entityId: userId,
      details: {
        userName: orgUser.user.name,
        userEmail: orgUser.user.email,
        shopName: shop.name,
        shopRole,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Assign store error:', error)
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Assignment already exists' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Failed to assign store' }, { status: 500 })
  }
}

