import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { requirePaidWrite } from '@/lib/billing/guards'
import { addOrBumpLine } from '@/lib/domain/purchaseLists'
import { purchaseListErrorResponse } from '@/lib/purchaseLists/httpErrors'

// No activity log entry here: line edits are noise, the list-level entries
// (create / send / delete) already carry the story.
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    const blocked = requirePaidWrite(user)
    if (blocked) return blocked
    if (!user.currentShopId) return NextResponse.json({ error: 'No shop selected' }, { status: 400 })

    const body = await request.json()
    const line = await addOrBumpLine(
      params.id,
      { productId: body.productId, quantity: Number(body.quantity) || 1 },
      user.id
    )

    return NextResponse.json(line, { status: 201 })
  } catch (error: any) {
    return purchaseListErrorResponse(error, 'Add purchase list line error:')
  }
}
