import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db/prisma'

interface RouteParams {
  params: { id: string }
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const org = await prisma.organization.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        name: true,
        status: true,
        city: true,
      },
    })

    if (!org) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const isOrgAdmin = user.organizations?.some((o: any) => o.orgId === params.id)
    const isPlatformAdmin = user.role === 'PLATFORM_ADMIN'

    if (!isPlatformAdmin && !isOrgAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json({ organization: org })
  } catch (error) {
    console.error('Admin org fetch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

