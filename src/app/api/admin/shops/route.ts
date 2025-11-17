import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { createShopWithOwner, listShops } from '@/lib/domain/shops'

// GET: List all shops (admin only)
export async function GET() {
  try {
    const session = await getSession()

    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const shops = await listShops(session.userId)

    return NextResponse.json({ shops })
  } catch (error: any) {
    console.error('List shops error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to list shops' },
      { status: 500 }
    )
  }
}

// POST: Create new shop + owner user (admin only)
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()

    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
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
      session.userId
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

