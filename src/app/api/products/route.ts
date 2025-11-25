import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import {
  createProduct,
  listProducts,
  CreateProductInput,
  ProductFilters,
} from '@/lib/domain/products'
import { 
  canManageProducts, 
  hasShopAccess, 
  UnauthorizedResponse, 
  ForbiddenResponse 
} from '@/lib/permissions'

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
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '50'),
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
    const input: CreateProductInput = {
      name: body.name,
      sku: body.sku,
      barcode: body.barcode,
      unit: body.unit,
      price: parseFloat(body.price),
      costPrice: body.costPrice ? parseFloat(body.costPrice) : undefined,
      category: body.category,
      trackStock: body.trackStock !== undefined ? body.trackStock : true,
      reorderLevel: body.reorderLevel ? parseInt(body.reorderLevel) : undefined,
      cartonPrice: body.cartonPrice ? parseFloat(body.cartonPrice) : undefined,
      cartonSize: body.cartonSize ? parseInt(body.cartonSize) : undefined,
      cartonBarcode: body.cartonBarcode || undefined,
    }

    const product = await createProduct(user.currentShopId, input, user.id)

    return NextResponse.json({ product }, { status: 201 })
  } catch (error: any) {
    console.error('Create product error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create product' },
      { status: 400 }
    )
  }
}
