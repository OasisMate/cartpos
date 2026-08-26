import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { requirePaidWrite } from '@/lib/billing/guards'
import { isDemoUser, DemoBlockedResponse } from '@/lib/demo'
import { deletePurchaseList, getPurchaseList, updatePurchaseList } from '@/lib/domain/purchaseLists'
import { logActivity, ActivityActions, EntityTypes } from '@/lib/audit/activityLog'
import { purchaseListErrorResponse } from '@/lib/purchaseLists/httpErrors'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    if (!user.currentShopId) return NextResponse.json({ error: 'No shop selected' }, { status: 400 })

    const list = await getPurchaseList(params.id, user.id)
    return NextResponse.json(list)
  } catch (error: any) {
    return purchaseListErrorResponse(error, 'Get purchase list error:')
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    const blocked = requirePaidWrite(user)
    if (blocked) return blocked
    if (!user.currentShopId) return NextResponse.json({ error: 'No shop selected' }, { status: 400 })

    const body = await request.json()
    const list = await updatePurchaseList(
      params.id,
      {
        name: body.name,
        supplierId: body.supplierId,
        notes: body.notes,
        status: body.status,
      },
      user.id
    )

    if (user.currentOrgId && body.status === 'SENT') {
      await logActivity({
        userId: user.id,
        orgId: user.currentOrgId,
        shopId: user.currentShopId,
        action: ActivityActions.SEND_PURCHASE_LIST,
        entityType: EntityTypes.PURCHASE_LIST,
        entityId: list.id,
        details: { name: list.name, supplierId: list.supplierId },
        ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
        userAgent: request.headers.get('user-agent') || null,
      })
    }

    return NextResponse.json(list)
  } catch (error: any) {
    return purchaseListErrorResponse(error, 'Update purchase list error:')
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    const blocked = requirePaidWrite(user)
    if (blocked) return blocked
    if (!user.currentShopId) return NextResponse.json({ error: 'No shop selected' }, { status: 400 })
    if (isDemoUser(user)) return DemoBlockedResponse()

    await deletePurchaseList(params.id, user.id)

    if (user.currentOrgId) {
      await logActivity({
        userId: user.id,
        orgId: user.currentOrgId,
        shopId: user.currentShopId,
        action: ActivityActions.DELETE_PURCHASE_LIST,
        entityType: EntityTypes.PURCHASE_LIST,
        entityId: params.id,
        ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
        userAgent: request.headers.get('user-agent') || null,
      })
    }

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return purchaseListErrorResponse(error, 'Delete purchase list error:')
  }
}
