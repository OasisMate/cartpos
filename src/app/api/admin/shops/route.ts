import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { createShopWithOwner, listShops } from '@/lib/domain/shops'

// GET: List all shops (platform admin only)
export async function GET() {
  try {
    const user = await getCurrentUser()

    if (!user || user.role !== 'PLATFORM_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const shops = await listShops(user.id)

    return NextResponse.json({ shops })
  } catch (error: any) {
    console.error('List shops error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to list shops' },
      { status: 500 }
    )
  }
}

// POST: Create new shop + owner user (platform admin only)
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()

    if (!user || user.role !== 'PLATFORM_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { name, city, orgId, ownerName, ownerEmail, ownerPassword } = body

    // Validate required fields
    if (!name || !orgId || !ownerName || !ownerEmail || !ownerPassword) {
      return NextResponse.json(
        { error: 'Missing required fields: name, orgId, ownerName, ownerEmail, ownerPassword' },
        { status: 400 }
      )
    }

    const result = await createShopWithOwner(
      {
        name,
        city,
        orgId,
        ownerName,
        ownerEmail,
        ownerPassword,
      },
      user.id
    )

    return NextResponse.json({
      shop: {
        id: result.shop.id,
        name: result.shop.name,
        city: result.shop.city,
        createdAt: result.shop.createdAt,
      },
      owner: {
        id: result.owner.id,
        name: result.owner.name,
        email: result.owner.email,
      },
    })
  } catch (error: any) {
    console.error('Create shop error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create shop' },
      { status: 500 }
    )
  }
}

