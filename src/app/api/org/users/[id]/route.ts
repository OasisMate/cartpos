import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getCurrentUser } from '@/lib/auth'
import { normalizePhone, validatePhone, normalizeCNIC, validateCNIC } from '@/lib/validation'
import { logActivity, ActivityActions, EntityTypes } from '@/lib/audit/activityLog'
import { canManageOrgUsers, UnauthorizedResponse, ForbiddenResponse } from '@/lib/permissions'

// GET: Get user details
export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser()
  if (!user) return UnauthorizedResponse()

  const userId = params.id
  const orgId = user.currentOrgId

  if (!orgId) {
    return NextResponse.json({ error: 'No organization selected' }, { status: 400 })
  }

  // Check permission using the permissions utility
  // Also verify directly from database as fallback
  let hasPermission = canManageOrgUsers(user, orgId)
  
  if (!hasPermission) {
    // Fallback: Check directly from database
    const [orgUserCheck, orgCheck] = await Promise.all([
      prisma.organizationUser.findFirst({
        where: {
          userId: user.id,
          orgId: orgId,
          orgRole: 'ORG_ADMIN',
        },
      }),
      prisma.organization.findUnique({
        where: { id: orgId },
        select: { requestedBy: true },
      }),
    ])
    
    // User is org admin OR user created the organization OR platform admin
    hasPermission = !!orgUserCheck || orgCheck?.requestedBy === user.id || user.role === 'PLATFORM_ADMIN'
  }
  
  if (!hasPermission) {
    return ForbiddenResponse('Only Org Admins can view user details')
  }

  try {
    // Check if user belongs to organization (either via OrganizationUser or via shops)
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

    // Get user directly if not in organization table (might be shop-only user)
    const userData = orgUser?.user || await prisma.user.findUnique({
      where: { id: userId },
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
    })

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
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

    // Verify user has at least one shop in this org or is an org user
    if (orgShops.length === 0 && !orgUser) {
      return NextResponse.json({ error: 'User not found in organization' }, { status: 404 })
    }

    return NextResponse.json({
      user: {
        id: userData.id,
        name: userData.name,
        email: userData.email,
        phone: userData.phone,
        cnic: userData.cnic,
        isWhatsApp: userData.isWhatsApp,
        platformRole: userData.role,
        orgRole: orgUser?.orgRole || null,
        shops: orgShops.map((us) => ({
          shopId: us.shopId,
          shopRole: us.shopRole,
          shop: {
            id: us.shop.id,
            name: us.shop.name,
          },
        })),
        createdAt: userData.createdAt,
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
  if (!user) return UnauthorizedResponse()

  const userId = params.id
  const orgId = user.currentOrgId

  if (!orgId) {
    return NextResponse.json({ error: 'No organization selected' }, { status: 400 })
  }

  // Check permission using the permissions utility
  // Also verify directly from database as fallback
  let hasPermission = canManageOrgUsers(user, orgId)
  
  if (!hasPermission) {
    // Fallback: Check directly from database
    const [orgUserCheck, orgCheck] = await Promise.all([
      prisma.organizationUser.findFirst({
        where: {
          userId: user.id,
          orgId: orgId,
          orgRole: 'ORG_ADMIN',
        },
      }),
      prisma.organization.findUnique({
        where: { id: orgId },
        select: { requestedBy: true },
      }),
    ])
    
    // User is org admin OR user created the organization OR platform admin
    hasPermission = !!orgUserCheck || orgCheck?.requestedBy === user.id || user.role === 'PLATFORM_ADMIN'
  }
  
  if (!hasPermission) {
    return ForbiddenResponse('Only Org Admins can update users')
  }

  try {
    const body = await request.json()
    const { name, phone, cnic, isWhatsApp, orgRole } = body

    // Check if user belongs to organization (either via OrganizationUser or via shops)
    const orgUser = await prisma.organizationUser.findFirst({
      where: {
        userId,
        orgId,
      },
      include: {
        user: true,
      },
    })

    // Get user directly
    const userData = orgUser?.user || await prisma.user.findUnique({
      where: { id: userId },
    })

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Verify user has shops in this org or is an org user
    const userShopsInOrg = await prisma.userShop.findMany({
      where: { userId },
      include: {
        shop: {
          select: { orgId: true },
        },
      },
    })

    const hasOrgShop = userShopsInOrg.some((us) => us.shop.orgId === orgId)
    if (!orgUser && !hasOrgShop) {
      return NextResponse.json({ error: 'User not found in organization' }, { status: 404 })
    }

    // Get old values for activity log
    const oldUser = {
      name: userData.name,
      phone: userData.phone,
      cnic: userData.cnic,
      isWhatsApp: userData.isWhatsApp,
      orgRole: orgUser?.orgRole || null,
    }

    const updateData: any = {}

    if (name !== undefined) {
      if (!name || name.trim().length === 0) {
        return NextResponse.json({ error: 'Name is required' }, { status: 400 })
      }
      updateData.name = name.trim()
    }

    // Allow updating phone - only validate format if provided, allow clearing
    if (phone !== undefined) {
      if (phone && phone.trim()) {
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
        // Allow clearing phone
        updateData.phone = null
      }
    }

    // Allow updating CNIC - only validate format if provided, allow clearing
    if (cnic !== undefined) {
      if (cnic && cnic.trim()) {
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
        // Allow clearing CNIC
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
      if (orgRole) {
        // Create or update organization user
        await prisma.organizationUser.upsert({
          where: {
            userId_orgId: {
              userId,
              orgId,
            },
          },
          create: {
            userId,
            orgId,
            orgRole,
          },
          update: {
            orgRole,
          },
        })
      } else {
        // Remove org role if set to null/empty
        await prisma.organizationUser.deleteMany({
          where: {
            userId,
            orgId,
          },
        })
      }
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
  if (!user) return UnauthorizedResponse()

  const userId = params.id
  const orgId = user.currentOrgId

  if (!orgId) {
    return NextResponse.json({ error: 'No organization selected' }, { status: 400 })
  }

  // Check permission using the permissions utility
  // Also verify directly from database as fallback
  let hasPermission = canManageOrgUsers(user, orgId)
  
  if (!hasPermission) {
    // Fallback: Check directly from database
    const [orgUserCheck, orgCheck] = await Promise.all([
      prisma.organizationUser.findFirst({
        where: {
          userId: user.id,
          orgId: orgId,
          orgRole: 'ORG_ADMIN',
        },
      }),
      prisma.organization.findUnique({
        where: { id: orgId },
        select: { requestedBy: true },
      }),
    ])
    
    // User is org admin OR user created the organization OR platform admin
    hasPermission = !!orgUserCheck || orgCheck?.requestedBy === user.id || user.role === 'PLATFORM_ADMIN'
  }
  
  if (!hasPermission) {
    return ForbiddenResponse('Only Org Admins can remove users')
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

