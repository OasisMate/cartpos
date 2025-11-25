import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { updateProduct, getProduct, UpdateProductInput } from '@/lib/domain/products'

// GET: Get single product
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const product = await getProduct(params.id, user.id)

    return NextResponse.json({ product })
  } catch (error: any) {
    console.error('Get product error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get product' },
      { status: 404 }
    )
  }
}

// PUT: Update product
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await request.json()
    const input: UpdateProductInput = {
      name: body.name,
      sku: body.sku,
      barcode: body.barcode,
      unit: body.unit,
      price: body.price ? parseFloat(body.price) : undefined,
      cartonPrice: body.cartonPrice ? parseFloat(body.cartonPrice) : undefined,
      costPrice: body.costPrice ? parseFloat(body.costPrice) : undefined,
      category: body.category,
      trackStock: body.trackStock,
      reorderLevel: body.reorderLevel ? parseInt(body.reorderLevel) : undefined,
      cartonSize: body.cartonSize ? parseInt(body.cartonSize) : undefined,
      cartonBarcode: body.cartonBarcode || undefined,
    }

    const product = await updateProduct(params.id, input, user.id)

    return NextResponse.json({ product })
  } catch (error: any) {
    console.error('Update product error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update product' },
      { status: 400 }
    )
  }
}
