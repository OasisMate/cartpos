import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db/prisma'

export async function GET() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'PLATFORM_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        cnic: true,
        isWhatsApp: true,
        role: true,
        createdAt: true,
        organizations: {
          select: {
            orgId: true,
            orgRole: true,
            organization: {
              select: {
                id: true,
                name: true,
                status: true,
              },
            },
          },
        },
        shops: {
          select: {
            shopId: true,
            shopRole: true,
            shop: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ users })
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

