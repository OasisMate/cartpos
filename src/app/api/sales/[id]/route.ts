import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { DemoBlockedResponse } from '@/lib/demo'
import { prisma } from '@/lib/db/prisma'
import { deleteSale, updateSale, CreateSaleInput } from '@/lib/domain/sales'
import { logActivity, ActivityActions, EntityTypes } from '@/lib/audit/activityLog'

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
              select: {
                id: true,
                name: true,
                unit: true,
                price: true,
                cartonSize: true,
                cartonBarcode: true,
                packagingLevels: true,
              },
            },
          },
        },
        payments: true,
        createdBy: { select: { name: true } },
        shop: {
          include: {
            settings: {
              select: {
                logoUrl: true,
                receiptHeaderDisplay: true,
              },
            },
          },
        },
      },
    })

    if (!invoice || invoice.shopId !== user.currentShopId) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    // servedBy drives the "Served by" line on the reprinted receipt (first name only).
    return NextResponse.json({ invoice: { ...invoice, servedBy: invoice.createdBy?.name ?? null } })
  } catch (error: any) {
    console.error('Get sale error:', error)
    return NextResponse.json({ error: error.message || 'Failed to get sale' }, { status: 500 })
  }
}

// PUT: Edit an existing sale in place (reverses old effects, re-applies new ones).
export async function PUT(
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
    if (user.isDemoOrg) return DemoBlockedResponse()

    const body = await request.json()
    if (!Array.isArray(body.items)) {
      return NextResponse.json({ error: 'Items are required' }, { status: 400 })
    }
    const input: CreateSaleInput = {
      customerId: body.customerId || undefined,
      items: body.items.map((item: any) => ({
        productId: item.productId,
        quantity: parseFloat(item.quantity),
        unitPrice: parseFloat(item.unitPrice),
        lineTotal: parseFloat(item.lineTotal),
        unitsPerItem: item.unitsPerItem != null ? parseFloat(item.unitsPerItem) : undefined,
        packName: item.packName || undefined,
      })),
      subtotal: parseFloat(body.subtotal),
      discount: parseFloat(body.discount || 0),
      serviceCharge: body.serviceCharge ? parseFloat(body.serviceCharge) : 0,
      deliveryCharge: body.deliveryCharge ? parseFloat(body.deliveryCharge) : 0,
      total: parseFloat(body.total),
      paymentStatus: body.paymentStatus,
      paymentMethod: body.paymentMethod,
      amountReceived: body.amountReceived ? parseFloat(body.amountReceived) : undefined,
    }

    const result = await updateSale(user.currentShopId, params.id, input, user.id)

    if (user.currentOrgId) {
      await logActivity({
        userId: user.id,
        orgId: user.currentOrgId,
        shopId: user.currentShopId,
        action: ActivityActions.UPDATE_SALE,
        entityType: EntityTypes.SALE,
        entityId: result.invoice.id,
        details: {
          number: result.invoice.number,
          total: Number(result.invoice.total),
          paymentStatus: result.invoice.paymentStatus,
        },
        ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
        userAgent: request.headers.get('user-agent') || null,
      })
    }

    return NextResponse.json({ invoice: result.invoice, stockWarnings: result.stockWarnings })
  } catch (error: any) {
    console.error('Update sale error:', error)
    return NextResponse.json({ error: error.message || 'Failed to update sale' }, { status: 400 })
  }
}

export async function DELETE(
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

    if (user.isDemoOrg) return DemoBlockedResponse()

    await deleteSale(user.currentShopId, params.id, user.id)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Delete sale error:', error)
    return NextResponse.json({ error: error.message || 'Failed to delete sale' }, { status: 500 })
  }
}


