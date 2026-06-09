import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { recordSupplierPayment } from '@/lib/domain/suppliers'
import { logActivity, ActivityActions, EntityTypes } from '@/lib/audit/activityLog'

// POST: record a payment made to the supplier (reduces what the shop owes)
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await request.json()

    const entry = await recordSupplierPayment(
      params.id,
      { amount: body.amount, method: body.method, note: body.note },
      user.id
    )

    if (user.currentOrgId) {
      await logActivity({
        userId: user.id,
        orgId: user.currentOrgId,
        shopId: entry.shopId,
        action: ActivityActions.RECORD_SUPPLIER_PAYMENT,
        entityType: EntityTypes.SUPPLIER,
        entityId: params.id,
        details: { amount: Number(entry.amount), method: entry.method },
        ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
        userAgent: request.headers.get('user-agent') || null,
      })
    }

    return NextResponse.json({ entry: { id: entry.id, amount: Number(entry.amount) } }, { status: 201 })
  } catch (error: any) {
    console.error('Record supplier payment error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to record payment' },
      { status: 400 }
    )
  }
}
