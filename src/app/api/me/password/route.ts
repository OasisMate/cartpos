import { NextResponse } from 'next/server'
import { getCurrentUser, verifyPassword, hashPassword, reissueSession } from '@/lib/auth'
import { REVOKE_SESSIONS } from '@/lib/auth/token-version'
import { prisma } from '@/lib/db/prisma'
import { logActivity, ActivityActions, EntityTypes } from '@/lib/audit/activityLog'
import { passwordPolicyError } from '@/lib/validation/password'

export async function PUT(request: Request) {
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { currentPassword, newPassword } = body

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: 'Current password and new password are required' },
        { status: 400 }
      )
    }

    const pwError = passwordPolicyError(newPassword)
    if (pwError) {
      return NextResponse.json({ error: pwError }, { status: 400 })
    }

    // Get user with password hash
    const userWithPassword = await prisma.user.findUnique({
      where: { id: user.id },
      select: { password: true },
    })

    if (!userWithPassword) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Verify current password
    const isValidPassword = await verifyPassword(currentPassword, userWithPassword.password)
    if (!isValidPassword) {
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 })
    }

    // Check if new password is same as current
    const isSamePassword = await verifyPassword(newPassword, userWithPassword.password)
    if (isSamePassword) {
      return NextResponse.json(
        { error: 'New password must be different from current password' },
        { status: 400 }
      )
    }

    // Hash new password
    const hashedPassword = await hashPassword(newPassword)

    // Update password. Changing it signs out every OTHER device this account is logged
    // in on, which is what someone changing a password after a scare expects.
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword, ...REVOKE_SESSIONS },
      select: { id: true, email: true, role: true, tokenVersion: true },
    })

    // Every other device, but not this one: re-stamp the caller's own cookie with the new
    // version so the person who just changed their password is not bounced to the login
    // screen for their trouble. Their remember-me expiry is preserved.
    await reissueSession(updated)

    // Log activity
    const orgId = user.currentOrgId || user.organizations?.[0]?.orgId
    if (orgId) {
      await logActivity({
        userId: user.id,
        orgId,
        shopId: null,
        action: ActivityActions.CHANGE_PASSWORD,
        entityType: EntityTypes.PROFILE,
        entityId: user.id,
        details: {
          changedAt: new Date().toISOString(),
        },
      })
    }

    return NextResponse.json({ success: true, message: 'Password changed successfully' })
  } catch (error: any) {
    console.error('Password change error:', error)
    return NextResponse.json({ error: 'Failed to change password' }, { status: 500 })
  }
}

