import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getCurrentUser } from '@/lib/auth'
import { normalizePhone, validatePhone, normalizeCNIC, validateCNIC } from '@/lib/validation'
import { logActivity, ActivityActions, EntityTypes } from '@/lib/audit/activityLog'

function ensureOrgAdmin(user: any) {
  const isOrgAdmin = user?.organizations?.some(
    (o: any) => o.orgId === user.currentOrgId && o.orgRole === 'ORG_ADMIN'
  )
  if (!isOrgAdmin && user?.role !== 'PLATFORM_ADMIN') {
    throw new Error('FORBIDDEN')
  }
}

// GET: Get user details
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

  const userId = params.id
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
            id: true,
            name: true,
            email: true,
            phone: true,
            cnic: true,
            isWhatsApp: true,
            role: true,
            createdAt: true,
          },
        },
      },
    })

    if (!orgUser) {
      return NextResponse.json({ error: 'User not found in organization' }, { status: 404 })
    }

    // Get shop assignments
    const userShops = await prisma.userShop.findMany({
      where: { userId },
      include: {
        shop: {
          select: {
            id: true,
            name: true,
            orgId: true,
          },
        },
      },
    })

    // Filter shops that belong to this organization
    const orgShops = userShops.filter((us) => us.shop.orgId === orgId)

    return NextResponse.json({
      user: {
        id: orgUser.user.id,
        name: orgUser.user.name,
        email: orgUser.user.email,
        phone: orgUser.user.phone,
        cnic: orgUser.user.cnic,
        isWhatsApp: orgUser.user.isWhatsApp,
        platformRole: orgUser.user.role,
        orgRole: orgUser.orgRole,
        shops: orgShops.map((us) => ({
          shopId: us.shopId,
          shopRole: us.shopRole,
          shop: {
            id: us.shop.id,
            name: us.shop.name,
          },
        })),
        createdAt: orgUser.user.createdAt,
      },
    })
  } catch (error) {
    console.error('Get user error:', error)
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 })
  }
}

// PUT: Update user (name, phone, WhatsApp, org role, shop assignments)
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

  const userId = params.id
  const orgId = user.currentOrgId

  if (!orgId) {
    return NextResponse.json({ error: 'No organization selected' }, { status: 400 })
  }

  try {
    const body = await request.json()
    const { name, phone, cnic, isWhatsApp, orgRole } = body

    // Verify user belongs to organization
    const orgUser = await prisma.organizationUser.findFirst({
      where: {
        userId,
        orgId,
      },
      include: {
        user: true,
      },
    })

    if (!orgUser) {
      return NextResponse.json({ error: 'User not found in organization' }, { status: 404 })
    }

    // Get old values for activity log
    const oldUser = {
      name: orgUser.user.name,
      phone: orgUser.user.phone,
      cnic: orgUser.user.cnic,
      isWhatsApp: orgUser.user.isWhatsApp,
      orgRole: orgUser.orgRole,
    }

    const updateData: any = {}

    if (name !== undefined) {
      if (!name || name.trim().length === 0) {
        return NextResponse.json({ error: 'Name is required' }, { status: 400 })
      }
      updateData.name = name.trim()
    }

    if (phone !== undefined) {
      if (phone) {
        const normalizedPhone = normalizePhone(phone, 'PK')
        if (!normalizedPhone || !validatePhone(phone, 'PK')) {
          return NextResponse.json({ error: 'Invalid phone number format' }, { status: 400 })
        }

        // Check if phone is already taken by another user
        const existingUser = await prisma.user.findUnique({
          where: { phone: normalizedPhone },
        })
        if (existingUser && existingUser.id !== userId) {
          return NextResponse.json({ error: 'Phone number already in use' }, { status: 409 })
        }

        updateData.phone = normalizedPhone
      } else {
        updateData.phone = null
      }
    }

    if (cnic !== undefined) {
      if (cnic) {
        const normalizedCnic = normalizeCNIC(cnic)
        if (!normalizedCnic || !validateCNIC(cnic)) {
          return NextResponse.json({ error: 'Invalid CNIC format. CNIC must be 13 digits.' }, { status: 400 })
        }

        const existingCnicUser = await prisma.user.findUnique({
          where: { cnic: normalizedCnic },
        })
        if (existingCnicUser && existingCnicUser.id !== userId) {
          return NextResponse.json({ error: 'CNIC already in use' }, { status: 409 })
        }

        updateData.cnic = normalizedCnic
      } else {
        updateData.cnic = null
      }
    }

    if (isWhatsApp !== undefined) {
      updateData.isWhatsApp = Boolean(isWhatsApp)
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
    })

    // Update org role if provided
    if (orgRole !== undefined) {
      await prisma.organizationUser.update({
        where: {
          userId_orgId: {
            userId,
            orgId,
          },
        },
        data: { orgRole },
      })
    }

    // Log activity
    await logActivity({
      userId: user.id,
      orgId,
      shopId: null,
      action: ActivityActions.UPDATE_USER,
      entityType: EntityTypes.USER,
      entityId: userId,
      details: {
        old: oldUser,
        new: {
          name: updatedUser.name,
          phone: updatedUser.phone,
          cnic: updateData.cnic !== undefined ? updateData.cnic : oldUser.cnic,
          isWhatsApp: updatedUser.isWhatsApp,
          orgRole: orgRole !== undefined ? orgRole : oldUser.orgRole,
        },
      },
    })

    return NextResponse.json({
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        phone: updatedUser.phone,
        cnic: updatedUser.cnic,
        isWhatsApp: updatedUser.isWhatsApp,
      },
    })
  } catch (error: any) {
    console.error('Update user error:', error)
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Phone number already in use' }, { status: 409 })
    }
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
  }
}

// DELETE: Remove user from organization
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

  const userId = params.id
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

    // Prevent deleting yourself
    if (userId === user.id) {
      return NextResponse.json({ error: 'Cannot remove yourself from organization' }, { status: 400 })
    }

    // Get user's shop assignments in this org for activity log
    const userShops = await prisma.userShop.findMany({
      where: { userId },
      include: {
        shop: {
          select: { id: true, name: true, orgId: true },
        },
      },
    })

    // Filter shops that belong to this organization
    const orgShops = userShops.filter((us) => us.shop.orgId === orgId)

    // Remove all shop assignments in this org
    const shopIds = orgShops.map((us) => us.shopId)
    if (shopIds.length > 0) {
      await prisma.userShop.deleteMany({
        where: {
          userId,
          shopId: { in: shopIds },
        },
      })
    }

    // Remove from organization
    await prisma.organizationUser.delete({
      where: {
        userId_orgId: {
          userId,
          orgId,
        },
      },
    })

    // Log activity
    await logActivity({
      userId: user.id,
      orgId,
      shopId: null,
      action: ActivityActions.REMOVE_USER,
      entityType: EntityTypes.USER,
      entityId: userId,
      details: {
        userName: orgUser.user.name,
        userEmail: orgUser.user.email,
        removedShops: orgShops.map((us) => ({ shopId: us.shopId, shopName: us.shop.name })),
      },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Remove user error:', error)
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Failed to remove user' }, { status: 500 })
  }
}

