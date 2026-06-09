import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { recordSupplierCredit } from '@/lib/domain/suppliers'
import { logActivity, ActivityActions, EntityTypes } from '@/lib/audit/activityLog'

// POST: record an amount the shop owes the supplier (opening balance / manual adjustment)
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supplierId = params.id
  const back = new URL(`/store/suppliers/${supplierId}`, request.url)

  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    const formData = await request.formData()
    const amountRaw = formData.get('amount')
    const noteRaw = formData.get('note')

    const amount =
      typeof amountRaw === 'string' && amountRaw.trim() !== '' ? Number(amountRaw) : 0
    const note =
      typeof noteRaw === 'string' && noteRaw.trim() !== '' ? noteRaw.trim() : undefined

    if (!amount || isNaN(amount) || amount <= 0) {
      return NextResponse.redirect(back)
    }

    const entry = await recordSupplierCredit(
      supplierId,
      { amount, type: 'OPENING_BALANCE', note },
      user.id
    )

    if (user.currentOrgId) {
      await logActivity({
        userId: user.id,
        orgId: user.currentOrgId,
        shopId: entry.shopId,
        action: ActivityActions.RECORD_SUPPLIER_CREDIT,
        entityType: EntityTypes.SUPPLIER,
        entityId: supplierId,
        details: { amount: Number(entry.amount), type: entry.type },
        ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
        userAgent: request.headers.get('user-agent') || null,
      })
    }

    return NextResponse.redirect(back)
  } catch (error) {
    console.error('Record supplier credit error:', error)
    return NextResponse.redirect(back)
  }
}
