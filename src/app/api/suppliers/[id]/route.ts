import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { updateSupplier, getSupplier, UpdateSupplierInput } from '@/lib/domain/suppliers'

// GET: Get single supplier
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const supplier = await getSupplier(params.id, user.id)

    return NextResponse.json({ supplier })
  } catch (error: any) {
    console.error('Get supplier error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get supplier' },
      { status: 404 }
    )
  }
}

// PUT: Update supplier
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
    const input: UpdateSupplierInput = {
      name: body.name,
      phone: body.phone,
      notes: body.notes,
    }

    const supplier = await updateSupplier(params.id, input, user.id)

    return NextResponse.json({ supplier })
  } catch (error: any) {
    console.error('Update supplier error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update supplier' },
      { status: 400 }
    )
  }
}
