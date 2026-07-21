import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db/prisma'
import { logActivity, ActivityActions, EntityTypes } from '@/lib/audit/activityLog'
import { validateCustomerFields, checkCustomerDeleteAccess, customerHasHistory } from '@/lib/domain/customers'

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

    // Verify the customer belongs to the current shop (tenant isolation)
    const existing = await prisma.customer.findUnique({ where: { id: params.id } })
    if (!existing || existing.shopId !== user.currentShopId) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    const invalid = await validateCustomerFields(user.currentShopId, name, phone || '', params.id)
    if (invalid) {
      const { status, ...payload } = invalid
      return NextResponse.json(payload, { status })
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

// DELETE: Permanently remove a customer. Only the store manager (or platform
// admin) may delete, and only when the customer has no transaction history
// (no invoices, payments, ledger entries, returns, or quotations). This lets a
// shop clean up a customer added by mistake without ever losing real records.
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

    // Verify the customer belongs to the current shop (tenant isolation)
    const existing = await prisma.customer.findUnique({ where: { id: params.id } })
    if (!existing || existing.shopId !== user.currentShopId) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    const canDelete = await checkCustomerDeleteAccess(user.id, user.currentShopId)
    if (!canDelete) {
      return NextResponse.json(
        { error: 'Only a store manager can delete customers' },
        { status: 403 }
      )
    }

    if (await customerHasHistory(params.id)) {
      return NextResponse.json(
        { error: "This customer has transaction history and can't be deleted." },
        { status: 409 }
      )
    }

    await prisma.customer.delete({ where: { id: params.id } })

    if (user.currentOrgId) {
      await logActivity({
        userId: user.id,
        orgId: user.currentOrgId,
        shopId: user.currentShopId,
        action: ActivityActions.DELETE_CUSTOMER,
        entityType: EntityTypes.CUSTOMER,
        entityId: params.id,
        details: { name: existing.name, phone: existing.phone },
        ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
        userAgent: request.headers.get('user-agent') || null,
      })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Delete customer error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete customer' },
      { status: 500 }
    )
  }
}
