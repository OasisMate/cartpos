import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    if (!user.currentShopId) {
      return NextResponse.json({ error: 'No shop selected' }, { status: 400 })
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id: params.id },
      include: {
        customer: true,
        lines: {
          include: {
            product: {
              select: { id: true, name: true, unit: true },
            },
          },
        },
        payments: true,
        shop: true,
      },
    })

    if (!invoice || invoice.shopId !== user.currentShopId) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    return NextResponse.json({ invoice })
  } catch (error: any) {
    console.error('Get sale error:', error)
    return NextResponse.json({ error: error.message || 'Failed to get sale' }, { status: 500 })
  }
}


