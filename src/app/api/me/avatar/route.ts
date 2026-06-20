import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { DemoBlockedResponse } from '@/lib/demo'
import { prisma } from '@/lib/db/prisma'
import { UnauthorizedResponse } from '@/lib/permissions'
import { logActivity, ActivityActions, EntityTypes } from '@/lib/audit/activityLog'

// POST: Upload the current user's profile photo (stored as a base64 data URL).
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return UnauthorizedResponse()
    }

    if (user.isDemoOrg) return DemoBlockedResponse()

    const formData = await request.formData()
    const file = formData.get('avatar') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file type (PNG or JPEG)
    if (!file.type.includes('png') && !file.type.includes('jpeg') && !file.type.includes('jpg')) {
      return NextResponse.json({ error: 'Only PNG or JPEG images are allowed' }, { status: 400 })
    }

    // Validate file size (max 1MB) - avatar loads on every request via getCurrentUser
    if (file.size > 1 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size must be less than 1MB' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const base64 = buffer.toString('base64')
    const mimeType = file.type || 'image/png'
    const profileImageUrl = `data:${mimeType};base64,${base64}`

    await prisma.user.update({
      where: { id: user.id },
      data: { profileImageUrl },
    })

    const orgId = user.currentOrgId || user.organizations?.[0]?.orgId
    if (orgId) {
      await logActivity({
        userId: user.id,
        orgId,
        shopId: null,
        action: ActivityActions.UPDATE_PROFILE,
        entityType: EntityTypes.PROFILE,
        entityId: user.id,
        details: { profilePhoto: 'updated' },
      })
    }

    return NextResponse.json({ profileImageUrl })
  } catch (error: any) {
    console.error('Avatar upload error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to upload photo' },
      { status: 500 }
    )
  }
}

// DELETE: Remove the current user's profile photo.
export async function DELETE() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return UnauthorizedResponse()
    }

    if (user.isDemoOrg) return DemoBlockedResponse()

    await prisma.user.update({
      where: { id: user.id },
      data: { profileImageUrl: null },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Avatar delete error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to remove photo' },
      { status: 500 }
    )
  }
}
