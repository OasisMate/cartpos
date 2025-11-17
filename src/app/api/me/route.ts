import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db/prisma'
import { normalizePhone, validatePhone } from '@/lib/validation'
import { logActivity, ActivityActions, EntityTypes } from '@/lib/audit/activityLog'

export async function GET() {
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      cnic: user.cnic,
      isWhatsApp: user.isWhatsApp,
      role: user.role,
      organizations: user.organizations,
      currentOrgId: user.currentOrgId,
      shops: user.shops,
      currentShopId: user.currentShopId,
    },
  })
}

export async function PUT(request: Request) {
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { name, phone, isWhatsApp } = body

    // Only allow updating name, phone, and isWhatsApp
    // Email and CNIC are immutable
    const updateData: any = {}

    if (name !== undefined) {
      if (!name || name.trim().length === 0) {
        return NextResponse.json({ error: 'Name is required' }, { status: 400 })
      }
      updateData.name = name.trim()
    }

    if (phone !== undefined) {
      if (phone) {
        // Validate and normalize phone
        const normalizedPhone = normalizePhone(phone, 'PK')
        if (!normalizedPhone || !validatePhone(phone, 'PK')) {
          return NextResponse.json({ error: 'Invalid phone number format' }, { status: 400 })
        }

        // Check if phone is already taken by another user
        const existingUser = await prisma.user.findUnique({
          where: { phone: normalizedPhone },
        })
        if (existingUser && existingUser.id !== user.id) {
          return NextResponse.json({ error: 'Phone number already in use' }, { status: 409 })
        }

        updateData.phone = normalizedPhone
      } else {
        updateData.phone = null
      }
    }

    if (isWhatsApp !== undefined) {
      updateData.isWhatsApp = Boolean(isWhatsApp)
    }

    // Get old values for activity log
    const oldUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { name: true, phone: true, isWhatsApp: true },
    })

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: updateData,
    })

    // Log activity
    const orgId = user.currentOrgId || user.organizations?.[0]?.orgId
    if (orgId) {
      await logActivity({
        userId: user.id,
        orgId,
        shopId: null,
        action: ActivityActions.UPDATE_PROFILE,
        entityType: EntityTypes.PROFILE,
        entityId: user.id,
        details: {
          old: oldUser,
          new: {
            name: updatedUser.name,
            phone: updatedUser.phone,
            isWhatsApp: updatedUser.isWhatsApp,
          },
        },
      })
    }

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
    console.error('Profile update error:', error)
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Phone number already in use' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
  }
}

