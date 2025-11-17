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

// DELETE: Remove user from store
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string; storeId: string } }
) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  
  try {
    ensureOrgAdmin(user)
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const userId = params.id
  const storeId = params.storeId
  const orgId = user.currentOrgId

  if (!orgId) {
    return NextResponse.json({ error: 'No organization selected' }, { status: 400 })
  }

  try {
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
        id: storeId,
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

    // Get assignment for activity log
    const assignment = await prisma.userShop.findUnique({
      where: {
        userId_shopId: {
          userId,
          shopId: storeId,
        },
      },
    })

    if (!assignment) {
      return NextResponse.json({ error: 'User is not assigned to this store' }, { status: 404 })
    }

    // Remove assignment
    await prisma.userShop.delete({
      where: {
        userId_shopId: {
          userId,
          shopId: storeId,
        },
      },
    })

    // Log activity
    await logActivity({
      userId: user.id,
      orgId,
      shopId: storeId,
      action: ActivityActions.REMOVE_FROM_STORE,
      entityType: EntityTypes.USER,
      entityId: userId,
      details: {
        userName: orgUser.user.name,
        userEmail: orgUser.user.email,
        shopName: shop.name,
        shopRole: assignment.shopRole,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Remove from store error:', error)
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Failed to remove user from store' }, { status: 500 })
  }
}

