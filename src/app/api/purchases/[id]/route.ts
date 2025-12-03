import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getPurchase, updatePurchase, deletePurchase, UpdatePurchaseInput } from '@/lib/domain/purchases'

// GET: Get single purchase
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const purchase = await getPurchase(params.id, user.id)

    return NextResponse.json({ purchase })
  } catch (error: any) {
    console.error('Get purchase error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get purchase' },
      { status: 404 }
    )
  }
}

// PUT: Update purchase
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
    const input: UpdatePurchaseInput = {
      supplierId: body.supplierId,
      date: body.date ? new Date(body.date) : undefined,
      reference: body.reference,
      notes: body.notes,
      lines: body.lines ? body.lines.map((line: any) => ({
        productId: line.productId,
        quantity: parseFloat(line.quantity),
        unitCost: line.unitCost ? parseFloat(line.unitCost) : undefined,
      })) : undefined,
    }

    const purchase = await updatePurchase(params.id, input, user.id)

    return NextResponse.json({ purchase })
  } catch (error: any) {
    console.error('Update purchase error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update purchase' },
      { status: 400 }
    )
  }
}

// DELETE: Delete purchase
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    await deletePurchase(params.id, user.id)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Delete purchase error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete purchase' },
      { status: 400 }
    )
  }
}
