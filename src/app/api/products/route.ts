import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import {
  createProduct,
  listProducts,
  CreateProductInput,
  ProductFilters,
  ProductSortBy,
} from '@/lib/domain/products'
import {
  canManageProducts,
  hasShopAccess,
  UnauthorizedResponse,
  ForbiddenResponse
} from '@/lib/permissions'
import { logActivity, ActivityActions, EntityTypes } from '@/lib/audit/activityLog'

// GET: List products
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
    const filters: ProductFilters = {
      search: searchParams.get('search') || undefined,
      category: searchParams.get('category') || undefined,
      trackStock:
        searchParams.get('trackStock') === 'true'
          ? true
          : searchParams.get('trackStock') === 'false'
            ? false
            : undefined,
      page: Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1),
      limit: Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50', 10) || 50)),
    }

    const sortByParam = searchParams.get('sortBy')
    const allowedSorts: ProductSortBy[] = ['name', 'price', 'costPrice', 'sku', 'createdAt', 'updatedAt']
    if (sortByParam && allowedSorts.includes(sortByParam as ProductSortBy)) {
      filters.sortBy = sortByParam as ProductSortBy
      filters.sortDir = searchParams.get('sortDir') === 'asc' ? 'asc' : 'desc'
    }

    const result = await listProducts(user.currentShopId, filters)

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('List products error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to list products' },
      { status: 500 }
    )
  }
}

// POST: Create product
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

    // Check permission - only Store Managers can create products
    if (!canManageProducts(user, user.currentShopId)) {
      return ForbiddenResponse('Only Store Managers can create products')
    }

    const body = await request.json()
    
    // Validate and parse price
    const price = parseFloat(body.price)
    if (isNaN(price) || price <= 0) {
      return NextResponse.json(
        { error: 'Price must be a valid positive number' },
        { status: 400 }
      )
    }
    
    // Validate price range for DECIMAL(10,2): max 99,999,999.99
    if (price >= 100000000) {
      return NextResponse.json(
        { error: 'Price must be less than 100,000,000' },
        { status: 400 }
      )
    }
    
    // Validate cost price if provided
    let costPrice: number | undefined
    if (body.costPrice) {
      costPrice = parseFloat(body.costPrice)
      if (isNaN(costPrice) || costPrice < 0) {
        return NextResponse.json(
          { error: 'Cost price must be a valid non-negative number' },
          { status: 400 }
        )
      }
      if (costPrice >= 100000000) {
        return NextResponse.json(
          { error: 'Cost price must be less than 100,000,000' },
          { status: 400 }
        )
      }
    }
    
    // Validate carton price if provided
    let cartonPrice: number | undefined
    if (body.cartonPrice) {
      cartonPrice = parseFloat(body.cartonPrice)
      if (isNaN(cartonPrice) || cartonPrice <= 0) {
        return NextResponse.json(
          { error: 'Carton price must be a valid positive number' },
          { status: 400 }
        )
      }
      if (cartonPrice >= 100000000) {
        return NextResponse.json(
          { error: 'Carton price must be less than 100,000,000' },
          { status: 400 }
        )
      }
    }
    
    // Validate trade (wholesale) price if provided
    let tradePrice: number | undefined
    if (body.tradePrice !== undefined && body.tradePrice !== null && body.tradePrice !== '') {
      tradePrice = parseFloat(body.tradePrice)
      if (isNaN(tradePrice) || tradePrice <= 0) {
        return NextResponse.json(
          { error: 'Trade price must be a valid positive number' },
          { status: 400 }
        )
      }
      if (tradePrice >= 100000000) {
        return NextResponse.json(
          { error: 'Trade price must be less than 100,000,000' },
          { status: 400 }
        )
      }
    }

    const input: CreateProductInput = {
      name: body.name,
      sku: body.sku,
      barcode: body.barcode,
      unit: body.unit,
      price: price,
      tradePrice: tradePrice,
      costPrice: costPrice,
      trackStock: body.trackStock !== undefined ? body.trackStock : false,
      reorderLevel: body.reorderLevel ? parseInt(body.reorderLevel) : undefined,
      cartonPrice: cartonPrice,
      cartonSize: body.cartonSize ? parseInt(body.cartonSize) : undefined,
      cartonBarcode: body.cartonBarcode || undefined,
      initialStock: body.initialStock ? parseFloat(body.initialStock) : undefined,
    }

    const product = await createProduct(user.currentShopId, input, user.id)

    if (user.currentOrgId) {
      await logActivity({
        userId: user.id,
        orgId: user.currentOrgId,
        shopId: user.currentShopId,
        action: ActivityActions.CREATE_PRODUCT,
        entityType: EntityTypes.PRODUCT,
        entityId: product.id,
        details: { name: product.name, price: input.price },
        ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
        userAgent: request.headers.get('user-agent') || null,
      })
    }

    return NextResponse.json({ product }, { status: 201 })
  } catch (error: any) {
    console.error('Create product error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create product' },
      { status: 400 }
    )
  }
}
