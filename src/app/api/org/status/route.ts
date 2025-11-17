import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db/prisma'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's organization
    const orgUser = user.organizations?.[0]
    if (!orgUser) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 })
    }

    const org = await prisma.organization.findUnique({
      where: { id: orgUser.orgId },
      select: {
        id: true,
        name: true,
        status: true,
        createdAt: true,
        approvedAt: true,
        rejectionReason: true,
        suspensionReason: true,
      },
    })

    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    return NextResponse.json({ organization: org })
  } catch (error) {
    console.error('Org status error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

