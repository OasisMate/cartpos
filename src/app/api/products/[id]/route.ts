import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { updateProduct, getProduct, deleteProduct, UpdateProductInput } from '@/lib/domain/products'

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
    
    // Validate and parse price if provided
    let price: number | undefined
    if (body.price !== undefined && body.price !== null && body.price !== '') {
      price = parseFloat(body.price)
      if (isNaN(price) || price <= 0) {
        return NextResponse.json(
          { error: 'Price must be a valid positive number' },
          { status: 400 }
        )
      }
      if (price >= 100000000) {
        return NextResponse.json(
          { error: 'Price must be less than 100,000,000' },
          { status: 400 }
        )
      }
    }
    
    // Validate cost price if provided
    let costPrice: number | undefined
    if (body.costPrice !== undefined && body.costPrice !== null && body.costPrice !== '') {
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
    if (body.cartonPrice !== undefined && body.cartonPrice !== null && body.cartonPrice !== '') {
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
    
    const input: UpdateProductInput = {
      name: body.name,
      sku: body.sku,
      barcode: body.barcode,
      unit: body.unit,
      price: price,
      cartonPrice: cartonPrice,
      costPrice: costPrice,
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

// DELETE: Delete product
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    await deleteProduct(params.id, user.id)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Delete product error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete product' },
      { status: 400 }
    )
  }
}
