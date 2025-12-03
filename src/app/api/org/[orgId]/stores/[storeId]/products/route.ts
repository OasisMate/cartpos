import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db/prisma'
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
  ForbiddenResponse,
  NotFoundResponse,
} from '@/lib/permissions'

// GET: List products for a specific store (Platform Admin or Org Admin access)
export async function GET(
  request: NextRequest,
  { params }: { params: { orgId: string; storeId: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return UnauthorizedResponse()
    }

    const { orgId, storeId } = params

    // Verify store belongs to org
    const store = await prisma.shop.findUnique({
      where: { id: storeId },
      select: { orgId: true },
    })

    if (!store || store.orgId !== orgId) {
      return NotFoundResponse('Store not found in this organization')
    }

    // Check permission
    if (!hasShopAccess(user, storeId)) {
      return ForbiddenResponse('You do not have access to this store')
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

    const result = await listProducts(storeId, filters)

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('List products error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to list products' },
      { status: 500 }
    )
  }
}

// POST: Create product for a specific store (Store Manager or above)
export async function POST(
  request: NextRequest,
  { params }: { params: { orgId: string; storeId: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return UnauthorizedResponse()
    }

    const { orgId, storeId } = params

    // Verify store belongs to org
    const store = await prisma.shop.findUnique({
      where: { id: storeId },
      select: { orgId: true },
    })

    if (!store || store.orgId !== orgId) {
      return NotFoundResponse('Store not found in this organization')
    }

    // Check permission - only Store Managers can create products
    if (!canManageProducts(user, storeId)) {
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
      trackStock: body.trackStock !== undefined ? body.trackStock : true,
      reorderLevel: body.reorderLevel ? parseInt(body.reorderLevel) : undefined,
    }

    const product = await createProduct(storeId, input, user.id)

    return NextResponse.json({ product }, { status: 201 })
  } catch (error: any) {
    console.error('Create product error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create product' },
      { status: 500 }
    )
  }
}

