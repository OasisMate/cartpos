import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import {
  createStockAdjustment,
  listStockAdjustments,
  CreateStockAdjustmentInput,
  StockAdjustmentFilters,
} from '@/lib/domain/stock-adjustments'
import {
  canManageProducts,
  hasShopAccess,
  UnauthorizedResponse,
  ForbiddenResponse,
} from '@/lib/permissions'

// GET: List stock adjustments
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return UnauthorizedResponse()
    }

    if (!user.currentShopId) {
      return NextResponse.json(
        { error: 'No shop selected' },
        { status: 400 }
      )
    }

    // Check permission
    if (!hasShopAccess(user, user.currentShopId)) {
      return ForbiddenResponse('You do not have access to this shop')
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const filters: StockAdjustmentFilters = {
      productId: searchParams.get('productId') || undefined,
      type: searchParams.get('type') as any || undefined,
      startDate: searchParams.get('startDate')
        ? new Date(searchParams.get('startDate')!)
        : undefined,
      endDate: searchParams.get('endDate')
        ? new Date(searchParams.get('endDate')!)
        : undefined,
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '50'),
    }

    const result = await listStockAdjustments(user.currentShopId, filters)

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('List stock adjustments error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to list stock adjustments' },
      { status: 500 }
    )
  }
}

// POST: Create stock adjustment
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return UnauthorizedResponse()
    }

    if (!user.currentShopId) {
      return NextResponse.json(
        { error: 'No shop selected' },
        { status: 400 }
      )
    }

    // Check permission - only Store Managers can create adjustments
    if (!canManageProducts(user, user.currentShopId)) {
      return ForbiddenResponse('Only Store Managers can create stock adjustments')
    }

    const body = await request.json()
    const input: CreateStockAdjustmentInput = {
      productId: body.productId,
      type: body.type,
      quantity: parseFloat(body.quantity),
      notes: body.notes,
      date: body.date ? new Date(body.date) : undefined,
    }

    const result = await createStockAdjustment(user.currentShopId, input, user.id)

    return NextResponse.json(result, { status: 201 })
  } catch (error: any) {
    console.error('Create stock adjustment error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create stock adjustment' },
      { status: 400 }
    )
  }
}


