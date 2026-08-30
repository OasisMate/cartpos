import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { DemoBlockedResponse } from '@/lib/demo'
import { updateProduct, getProduct, deleteProduct, archiveProduct, unarchiveProduct, setTrackStock, setProductSalePrice, UpdateProductInput } from '@/lib/domain/products'
import { logActivity, ActivityActions, EntityTypes } from '@/lib/audit/activityLog'

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

    const input: UpdateProductInput = {
      name: body.name,
      sku: body.sku,
      barcode: body.barcode,
      unit: body.unit,
      price: price,
      // For clearable fields, an empty value that is present in the body means
      // "clear it" (0 / '' -> null in the domain), not "leave unchanged" (undefined).
      tradePrice: tradePrice !== undefined ? tradePrice : ('tradePrice' in body ? 0 : undefined),
      cartonPrice: cartonPrice !== undefined ? cartonPrice : ('cartonPrice' in body ? 0 : undefined),
      costPrice: costPrice,
      trackStock: body.trackStock,
      reorderLevel: body.reorderLevel ? parseInt(body.reorderLevel) : undefined,
      cartonSize: body.cartonSize ? parseInt(body.cartonSize) : ('cartonSize' in body ? 0 : undefined),
      cartonBarcode: 'cartonBarcode' in body ? (body.cartonBarcode || '') : undefined,
      packagingLevels: Array.isArray(body.packagingLevels) ? body.packagingLevels : undefined,
    }

    const product = await updateProduct(params.id, input, user.id)

    if (user.currentOrgId) {
      await logActivity({
        userId: user.id,
        orgId: user.currentOrgId,
        shopId: user.currentShopId || null,
        action: ActivityActions.UPDATE_PRODUCT,
        entityType: EntityTypes.PRODUCT,
        entityId: product.id,
        details: { name: product.name },
        ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
        userAgent: request.headers.get('user-agent') || null,
      })
    }

    return NextResponse.json({ product })
  } catch (error: any) {
    console.error('Update product error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update product' },
      { status: 400 }
    )
  }
}

// PATCH: Archive or restore a product (soft hide; preserves sales history)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    if (user.isDemoOrg) return DemoBlockedResponse()

    const body = await request.json()

    // Stock tracking is toggled straight from the products table. A shop that
    // just onboarded a couple of thousand catalog items turns it on for the
    // handful it actually counts, and opening the full edit form for one
    // checkbox is a chore. Kept out of PUT because PUT rebuilds every field
    // from the body, so a one-key request there risks clearing something.
    if (typeof body.trackStock === 'boolean') {
      const product = await setTrackStock(params.id, body.trackStock, user.id)
      if (user.currentOrgId) {
        await logActivity({
          userId: user.id,
          orgId: user.currentOrgId,
          shopId: user.currentShopId || null,
          action: ActivityActions.UPDATE_PRODUCT,
          entityType: EntityTypes.PRODUCT,
          entityId: product.id,
          details: { name: product.name, trackStock: body.trackStock },
          ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
          userAgent: request.headers.get('user-agent') || null,
        })
      }
      return NextResponse.json({ success: true, trackStock: product.trackStock })
    }

    // A price fixed straight from the POS. Same reason trackStock lives here rather than in
    // PUT: PUT rebuilds every field from the body, so a one-key request there would clear
    // whatever it did not mention. `priceField` names which of the four sale rates the cart
    // line was priced from, so we never rewrite a rate the cashier was not looking at.
    if (body.priceField !== undefined) {
      const allowed = ['price', 'tradePrice', 'cartonPrice', 'packLevel']
      if (!allowed.includes(body.priceField)) {
        return NextResponse.json(
          { error: `priceField must be one of ${allowed.join(', ')}` },
          { status: 400 }
        )
      }

      const value = parseFloat(body.value)
      if (isNaN(value) || value <= 0) {
        return NextResponse.json(
          { error: 'Price must be a valid positive number' },
          { status: 400 }
        )
      }
      if (value >= 100000000) {
        return NextResponse.json(
          { error: 'Price must be less than 100,000,000' },
          { status: 400 }
        )
      }

      const result = await setProductSalePrice(
        params.id,
        body.priceField,
        value,
        user.id,
        typeof body.packName === 'string' ? body.packName : undefined
      )

      if (user.currentOrgId) {
        await logActivity({
          userId: user.id,
          orgId: user.currentOrgId,
          shopId: user.currentShopId || null,
          action: ActivityActions.UPDATE_PRODUCT,
          entityType: EntityTypes.PRODUCT,
          entityId: result.id,
          details: {
            name: result.name,
            priceField: result.field,
            packName: result.packName,
            from: result.previousPrice,
            to: result.newPrice,
            source: 'pos',
          },
          ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
          userAgent: request.headers.get('user-agent') || null,
        })
      }

      return NextResponse.json({ success: true, price: result })
    }

    if (body.archived !== true && body.archived !== false) {
      return NextResponse.json(
        { error: 'Provide { archived: boolean } or { trackStock: boolean }' },
        { status: 400 }
      )
    }

    const result = body.archived
      ? await archiveProduct(params.id, user.id)
      : await unarchiveProduct(params.id, user.id)

    if (user.currentOrgId) {
      await logActivity({
        userId: user.id,
        orgId: user.currentOrgId,
        shopId: result.shopId,
        action: ActivityActions.UPDATE_PRODUCT,
        entityType: EntityTypes.PRODUCT,
        entityId: params.id,
        details: { name: result.name, archived: body.archived },
        ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
        userAgent: request.headers.get('user-agent') || null,
      })
    }

    return NextResponse.json({ success: true, archived: result.archived })
  } catch (error: any) {
    console.error('Archive product error:', error)
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

    if (user.isDemoOrg) return DemoBlockedResponse()

    const deleted = await deleteProduct(params.id, user.id)

    if (user.currentOrgId) {
      await logActivity({
        userId: user.id,
        orgId: user.currentOrgId,
        shopId: deleted.shopId,
        action: ActivityActions.DELETE_PRODUCT,
        entityType: EntityTypes.PRODUCT,
        entityId: params.id,
        details: { name: deleted.name },
        ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
        userAgent: request.headers.get('user-agent') || null,
      })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Delete product error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete product' },
      { status: 400 }
    )
  }
}
