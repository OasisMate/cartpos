import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db/prisma'
import { canManageProducts, UnauthorizedResponse, ForbiddenResponse } from '@/lib/permissions'

// POST: Upload shop logo
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return UnauthorizedResponse()
    }

    if (!user.currentShopId) {
      return NextResponse.json(
        { error: 'No shop selected' },
        { status: 400 }
      )
    }

    // Check permission - only STORE_MANAGER can upload logo
    if (!canManageProducts(user, user.currentShopId)) {
      return ForbiddenResponse('Only Store Managers can upload shop logo')
    }

    const formData = await request.formData()
    const file = formData.get('logo') as File | null

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validate file type (PNG only)
    if (!file.type.includes('png')) {
      return NextResponse.json(
        { error: 'Only PNG images are allowed' },
        { status: 400 }
      )
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File size must be less than 2MB' },
        { status: 400 }
      )
    }

    // Read file into buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Store logo directly in DB as a data URL (no filesystem dependency)
    const base64 = buffer.toString('base64')
    const mimeType = file.type || 'image/png'
    const logoUrl = `data:${mimeType};base64,${base64}`

    // Update shop settings with logo data URL
    await prisma.shopSettings.upsert({
      where: { shopId: user.currentShopId },
      update: { logoUrl },
      create: {
        shopId: user.currentShopId,
        logoUrl,
        receiptHeaderDisplay: 'NAME_ONLY',
      },
    })

    return NextResponse.json({ logoUrl })
  } catch (error: any) {
    console.error('Logo upload error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to upload logo' },
      { status: 500 }
    )
  }
}

// DELETE: Remove shop logo
export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return UnauthorizedResponse()
    }

    if (!user.currentShopId) {
      return NextResponse.json(
        { error: 'No shop selected' },
        { status: 400 }
      )
    }

    // Check permission
    if (!canManageProducts(user, user.currentShopId)) {
      return ForbiddenResponse('Only Store Managers can remove shop logo')
    }

    // Update shop settings to remove logo
    await prisma.shopSettings.update({
      where: { shopId: user.currentShopId },
      data: { logoUrl: null },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Logo delete error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to remove logo' },
      { status: 500 }
    )
  }
}

