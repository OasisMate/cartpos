import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db/prisma'
import { logActivity, ActivityActions, EntityTypes } from '@/lib/audit/activityLog'

// PUT: Update a customer's basic details (name/phone/notes) in the current shop.
// Balance is ledger-driven and is NOT editable here.
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

    const body = await request.json()
    const name = (body.name || '').trim()
    const phone = (body.phone || '').trim() || null
    const notes = (body.notes || '').trim() || null

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    // Verify the customer belongs to the current shop (tenant isolation)
    const existing = await prisma.customer.findUnique({ where: { id: params.id } })
    if (!existing || existing.shopId !== user.currentShopId) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    const customer = await prisma.customer.update({
      where: { id: params.id },
      data: { name, phone, notes },
    })

    if (user.currentOrgId) {
      await logActivity({
        userId: user.id,
        orgId: user.currentOrgId,
        shopId: user.currentShopId,
        action: ActivityActions.UPDATE_CUSTOMER,
        entityType: EntityTypes.CUSTOMER,
        entityId: customer.id,
        details: { name: customer.name },
        ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
        userAgent: request.headers.get('user-agent') || null,
      })
    }

    return NextResponse.json({
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        notes: customer.notes,
      },
    })
  } catch (error: any) {
    console.error('Update customer error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update customer' },
      { status: 500 }
    )
  }
}
