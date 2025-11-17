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

// GET: Get store details
export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  
  try {
    ensureOrgAdmin(user)
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const storeId = params.id
  const orgId = user.currentOrgId

  if (!orgId) {
    return NextResponse.json({ error: 'No organization selected' }, { status: 400 })
  }

  try {
    const shop = await prisma.shop.findFirst({
      where: {
        id: storeId,
        orgId, // Ensure shop belongs to user's organization
      },
      include: {
        settings: true,
        _count: {
          select: {
            products: true,
            customers: true,
            invoices: true,
            purchases: true,
          },
        },
      },
    })

    if (!shop) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    }

    return NextResponse.json({ store: shop })
  } catch (error) {
    console.error('Get store error:', error)
    return NextResponse.json({ error: 'Failed to fetch store' }, { status: 500 })
  }
}

// PUT: Update store
export async function PUT(
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

  const storeId = params.id
  const orgId = user.currentOrgId

  if (!orgId) {
    return NextResponse.json({ error: 'No organization selected' }, { status: 400 })
  }

  try {
    const body = await request.json()
    const { name, city, phone, addressLine1, addressLine2 } = body

    // Get old values for activity log
    const oldShop = await prisma.shop.findFirst({
      where: {
        id: storeId,
        orgId,
      },
    })

    if (!oldShop) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    }

    // Update store
    const updatedShop = await prisma.shop.update({
      where: { id: storeId },
      data: {
        name: name || oldShop.name,
        city: city !== undefined ? city : oldShop.city,
        phone: phone !== undefined ? phone : oldShop.phone,
        addressLine1: addressLine1 !== undefined ? addressLine1 : oldShop.addressLine1,
        addressLine2: addressLine2 !== undefined ? addressLine2 : oldShop.addressLine2,
      },
    })

    // Log activity
    await logActivity({
      userId: user.id,
      orgId,
      shopId: storeId,
      action: ActivityActions.UPDATE_STORE,
      entityType: EntityTypes.STORE,
      entityId: storeId,
      details: {
        old: {
          name: oldShop.name,
          city: oldShop.city,
          phone: oldShop.phone,
          addressLine1: oldShop.addressLine1,
          addressLine2: oldShop.addressLine2,
        },
        new: {
          name: updatedShop.name,
          city: updatedShop.city,
          phone: updatedShop.phone,
          addressLine1: updatedShop.addressLine1,
          addressLine2: updatedShop.addressLine2,
        },
      },
    })

    return NextResponse.json({ store: updatedShop })
  } catch (error: any) {
    console.error('Update store error:', error)
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Failed to update store' }, { status: 500 })
  }
}

// DELETE: Delete store
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  
  try {
    ensureOrgAdmin(user)
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const storeId = params.id
  const orgId = user.currentOrgId

  if (!orgId) {
    return NextResponse.json({ error: 'No organization selected' }, { status: 400 })
  }

  try {
    // Check if store exists and belongs to org
    const shop = await prisma.shop.findFirst({
      where: {
        id: storeId,
        orgId,
      },
      include: {
        _count: {
          select: {
            invoices: true,
            products: true,
          },
        },
      },
    })

    if (!shop) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    }

    // Prevent deletion if store has critical data
    if (shop._count.invoices > 0) {
      return NextResponse.json(
        { error: 'Cannot delete store with existing invoices. Please contact support.' },
        { status: 400 }
      )
    }

    // Get store name for activity log before deletion
    const storeName = shop.name

    // Delete store (cascade will handle related data)
    await prisma.shop.delete({
      where: { id: storeId },
    })

    // Log activity
    await logActivity({
      userId: user.id,
      orgId,
      shopId: storeId,
      action: ActivityActions.DELETE_STORE,
      entityType: EntityTypes.STORE,
      entityId: storeId,
      details: {
        name: storeName,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Delete store error:', error)
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Failed to delete store' }, { status: 500 })
  }
}

