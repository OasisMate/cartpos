import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import {
  createSupplier,
  listSuppliers,
  CreateSupplierInput,
  SupplierFilters,
} from '@/lib/domain/suppliers'

// GET: List suppliers
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    if (!user.currentShopId) {
      return NextResponse.json(
        { error: 'No shop selected' },
        { status: 400 }
      )
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const filters: SupplierFilters = {
      search: searchParams.get('search') || undefined,
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '50'),
    }

    const result = await listSuppliers(user.currentShopId, filters)

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('List suppliers error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to list suppliers' },
      { status: 500 }
    )
  }
}

// POST: Create supplier
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    if (!user.currentShopId) {
      return NextResponse.json(
        { error: 'No shop selected' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const input: CreateSupplierInput = {
      name: body.name,
      phone: body.phone,
      address: body.address,
      notes: body.notes,
    }

    const supplier = await createSupplier(user.currentShopId, input, user.id)

    return NextResponse.json({ supplier }, { status: 201 })
  } catch (error: any) {
    console.error('Create supplier error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create supplier' },
      { status: 400 }
    )
  }
}
