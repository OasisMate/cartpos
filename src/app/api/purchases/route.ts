import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import {
  createPurchase,
  listPurchases,
  CreatePurchaseInput,
  PurchaseFilters,
} from '@/lib/domain/purchases'
import { logActivity, ActivityActions, EntityTypes } from '@/lib/audit/activityLog'

// GET: List purchases
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    if (!user.currentShopId) {
      return NextResponse.json(
        { error: 'No shop selected' },
        { status: 400 }
      )
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const filters: PurchaseFilters = {
      supplierId: searchParams.get('supplierId') || undefined,
      startDate: searchParams.get('startDate')
        ? new Date(searchParams.get('startDate')!)
        : undefined,
      endDate: searchParams.get('endDate')
        ? new Date(searchParams.get('endDate')!)
        : undefined,
      page: Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1),
      limit: Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50', 10) || 50)),
    }

    const result = await listPurchases(user.currentShopId, filters)

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('List purchases error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to list purchases' },
      { status: 500 }
    )
  }
}

// POST: Create purchase
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    if (!user.currentShopId) {
      return NextResponse.json(
        { error: 'No shop selected' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const input: CreatePurchaseInput = {
      supplierId: body.supplierId || undefined,
      date: body.date ? new Date(body.date) : undefined,
      reference: body.reference,
      notes: body.notes,
      onCredit: body.onCredit === true,
      lines: body.lines.map((line: any) => ({
        productId: line.productId,
        quantity: parseFloat(line.quantity),
        unitCost: line.unitCost ? parseFloat(line.unitCost) : undefined,
      })),
    }

    const purchase = await createPurchase(user.currentShopId, input, user.id)

    if (user.currentOrgId) {
      await logActivity({
        userId: user.id,
        orgId: user.currentOrgId,
        shopId: user.currentShopId,
        action: ActivityActions.CREATE_PURCHASE,
        entityType: EntityTypes.PURCHASE,
        entityId: purchase.id,
        details: { reference: purchase.reference, lines: input.lines.length, onCredit: input.onCredit === true },
        ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
        userAgent: request.headers.get('user-agent') || null,
      })
    }

    return NextResponse.json({ purchase }, { status: 201 })
  } catch (error: any) {
    console.error('Create purchase error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create purchase' },
      { status: 400 }
    )
  }
}
