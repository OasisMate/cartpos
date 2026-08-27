import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { hashPassword } from '@/lib/auth'
import { REVOKE_SESSIONS } from '@/lib/auth/token-version'
import { passwordPolicyError } from '@/lib/validation/password'

export async function POST(request: NextRequest) {
  try {
    const { token, email, code, password } = await request.json()

    if (!password || (!token && !(email && code))) {
      return NextResponse.json(
        { error: 'Provide a reset token (or email + code) and a new password' },
        { status: 400 }
      )
    }

    const pwError = passwordPolicyError(password)
    if (pwError) {
      return NextResponse.json({ error: pwError }, { status: 400 })
    }

    // Find the reset token by opaque token, or by the user's email + 6-digit code.
    let resetToken = null
    if (token) {
      resetToken = await prisma.passwordResetToken.findUnique({
        where: { token },
        include: { user: true },
      })
    } else {
      const user = await prisma.user.findUnique({ where: { email: String(email).toLowerCase() } })
      if (user && /^\d{6}$/.test(String(code))) {
        resetToken = await prisma.passwordResetToken.findFirst({
          where: { userId: user.id, code: String(code), used: false },
          orderBy: { createdAt: 'desc' },
          include: { user: true },
        })
      }
    }

    if (!resetToken) {
      return NextResponse.json(
        { error: 'Invalid or expired reset token' },
        { status: 400 }
      )
    }

    // Check if token is used
    if (resetToken.used) {
      return NextResponse.json(
        { error: 'This reset link has already been used' },
        { status: 400 }
      )
    }

    // Check if token is expired
    if (new Date() > resetToken.expiresAt) {
      return NextResponse.json(
        { error: 'This reset link has expired' },
        { status: 400 }
      )
    }

    // Hash new password
    const hashedPassword = await hashPassword(password)

    // Update user password and mark token as used
    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetToken.userId },
        // A forgotten password is exactly the case where someone else may be holding a
        // live session cookie, so the reset has to end every session this user has. Rides
        // on the write that was happening anyway: no extra query.
        data: { password: hashedPassword, ...REVOKE_SESSIONS },
      }),
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { used: true },
      }),
    ])

    return NextResponse.json({
      message: 'Password has been reset successfully. You can now login with your new password.',
    })
  } catch (error) {
    console.error('Reset password error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

