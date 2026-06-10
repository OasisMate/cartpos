import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db/prisma'
import { issueVerificationEmail } from '@/lib/domain/email-verification'

// Platform admin nudges an unverified signup to confirm their email.
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getCurrentUser()
  if (!admin || admin.role !== 'PLATFORM_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const org = await prisma.organization.findUnique({
    where: { id: params.id },
    select: { requestedBy: true },
  })
  if (!org?.requestedBy) {
    return NextResponse.json({ error: 'Organization or requesting user not found' }, { status: 404 })
  }

  const user = await prisma.user.findUnique({
    where: { id: org.requestedBy },
    select: { id: true, email: true, name: true, emailVerified: true },
  })
  if (!user) {
    return NextResponse.json({ error: 'Requesting user not found' }, { status: 404 })
  }
  if (user.emailVerified) {
    return NextResponse.json({ error: 'This user has already verified their email' }, { status: 400 })
  }

  const result = await issueVerificationEmail({
    userId: user.id,
    email: user.email,
    name: user.name,
    origin: request.nextUrl.origin,
    reminder: true,
  })
  if (!result.success) {
    return NextResponse.json({ error: result.error || 'Failed to send reminder' }, { status: 502 })
  }

  return NextResponse.json({ success: true })
}
