import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { requirePaidWrite } from '@/lib/billing/guards'
import { createPurchaseList, listPurchaseLists } from '@/lib/domain/purchaseLists'
import { logActivity, ActivityActions, EntityTypes } from '@/lib/audit/activityLog'
import { purchaseListErrorResponse } from '@/lib/purchaseLists/httpErrors'
import { PurchaseListStatus } from '@prisma/client'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    if (!user.currentShopId) return NextResponse.json({ error: 'No shop selected' }, { status: 400 })

    const params = request.nextUrl.searchParams
    const status = params.get('status')
    const result = await listPurchaseLists(user.currentShopId, {
      status: status ? (status as PurchaseListStatus) : undefined,
      supplierId: params.get('supplierId') || undefined,
      page: parseInt(params.get('page') || '1', 10) || 1,
      limit: parseInt(params.get('limit') || '20', 10) || 20,
    })
    return NextResponse.json(result)
  } catch (error: any) {
    return purchaseListErrorResponse(error, 'List purchase lists error:')
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    const blocked = requirePaidWrite(user)
    if (blocked) return blocked
    if (!user.currentShopId) return NextResponse.json({ error: 'No shop selected' }, { status: 400 })

    const body = await request.json()
    const list = await createPurchaseList(
      user.currentShopId,
      { name: body.name, supplierId: body.supplierId, notes: body.notes },
      user.id
    )

    if (user.currentOrgId) {
      await logActivity({
        userId: user.id,
        orgId: user.currentOrgId,
        shopId: user.currentShopId,
        action: ActivityActions.CREATE_PURCHASE_LIST,
        entityType: EntityTypes.PURCHASE_LIST,
        entityId: list.id,
        details: { name: list.name, supplierId: list.supplierId },
        ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
        userAgent: request.headers.get('user-agent') || null,
      })
    }

    return NextResponse.json(list, { status: 201 })
  } catch (error: any) {
    return purchaseListErrorResponse(error, 'Create purchase list error:')
  }
}
