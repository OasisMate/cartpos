import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { createSale, listSales, CreateSaleInput } from '@/lib/domain/sales'
import { 
  canMakeSales, 
  hasShopAccess, 
  UnauthorizedResponse, 
  ForbiddenResponse 
} from '@/lib/permissions'

// GET: List sales
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
    const filters: any = {
      customerId: searchParams.get('customerId') || undefined,
      paymentStatus:
        (searchParams.get('paymentStatus') as 'PAID' | 'UDHAAR') || undefined,
      startDate: searchParams.get('startDate')
        ? new Date(searchParams.get('startDate')!)
        : undefined,
      endDate: searchParams.get('endDate')
        ? new Date(searchParams.get('endDate')!)
        : undefined,
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '50'),
    }

    const result = await listSales(user.currentShopId, filters)

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('List sales error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to list sales' },
      { status: 500 }
    )
  }
}

// POST: Create sale
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

    // Check permission - all shop users can make sales
    if (!canMakeSales(user, user.currentShopId)) {
      return ForbiddenResponse('You do not have permission to make sales')
    }

    const body = await request.json()
    const input: CreateSaleInput = {
      customerId: body.customerId || undefined,
      items: body.items.map((item: any) => ({
        productId: item.productId,
        quantity: parseFloat(item.quantity),
        unitPrice: parseFloat(item.unitPrice),
        lineTotal: parseFloat(item.lineTotal),
      })),
      subtotal: parseFloat(body.subtotal),
      discount: parseFloat(body.discount || 0),
      total: parseFloat(body.total),
      paymentStatus: body.paymentStatus,
      paymentMethod: body.paymentMethod,
      amountReceived: body.amountReceived ? parseFloat(body.amountReceived) : undefined,
    }

    const result = await createSale(user.currentShopId, input, user.id)

    return NextResponse.json(
      { 
        invoice: result.invoice,
        stockWarnings: result.stockWarnings,
      }, 
      { status: 201 }
    )
  } catch (error: any) {
    console.error('Create sale error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create sale' },
      { status: 400 }
    )
  }
}
