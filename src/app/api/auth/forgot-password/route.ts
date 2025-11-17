import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { sendEmail, generatePasswordResetEmail } from '@/lib/email'
import { randomBytes } from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
    })

    // Don't reveal if user exists or not (security best practice)
    // Always return success message even if user doesn't exist
    if (!user) {
      return NextResponse.json({
        message: 'If an account with that email exists, a password reset link has been sent.',
      })
    }

    // Generate secure token
    const token = randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour from now

    // Invalidate any existing reset tokens for this user
    await prisma.passwordResetToken.updateMany({
      where: {
        userId: user.id,
        used: false,
      },
      data: {
        used: true,
      },
    })

    // Create new reset token
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
      },
    })

    // Generate reset link
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin
    const resetLink = `${baseUrl}/reset-password?token=${token}`

    // Send email
    const emailResult = await sendEmail({
      to: user.email,
      subject: 'Reset Your CartPOS Password',
      html: generatePasswordResetEmail(resetLink, user.name),
    })

    if (!emailResult.success) {
      console.error('Failed to send password reset email:', emailResult.error)
      // Still return success to user (don't reveal email service issues)
      return NextResponse.json({
        message: 'If an account with that email exists, a password reset link has been sent.',
      })
    }

    return NextResponse.json({
      message: 'If an account with that email exists, a password reset link has been sent.',
    })
  } catch (error) {
    console.error('Forgot password error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

