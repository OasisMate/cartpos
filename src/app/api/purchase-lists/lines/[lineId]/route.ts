import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { requirePaidWrite } from '@/lib/billing/guards'
import { isDemoUser, DemoBlockedResponse } from '@/lib/demo'
import { removeLine, updateLine } from '@/lib/domain/purchaseLists'
import { purchaseListErrorResponse } from '@/lib/purchaseLists/httpErrors'

// No activity log entry here: line edits are noise, the list-level entries
// (create / send / delete) already carry the story.
export async function PATCH(request: NextRequest, { params }: { params: { lineId: string } }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    const blocked = requirePaidWrite(user)
    if (blocked) return blocked
    if (!user.currentShopId) return NextResponse.json({ error: 'No shop selected' }, { status: 400 })

    const body = await request.json()
    const line = await updateLine(
      params.lineId,
      {
        quantity: body.quantity !== undefined ? Number(body.quantity) : undefined,
        note: body.note,
        packName: body.packName !== undefined ? body.packName : undefined,
      },
      user.id
    )

    return NextResponse.json(line)
  } catch (error: any) {
    return purchaseListErrorResponse(error, 'Update purchase list line error:')
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { lineId: string } }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    const blocked = requirePaidWrite(user)
    if (blocked) return blocked
    if (!user.currentShopId) return NextResponse.json({ error: 'No shop selected' }, { status: 400 })
    if (isDemoUser(user)) return DemoBlockedResponse()

    await removeLine(params.lineId, user.id)
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return purchaseListErrorResponse(error, 'Remove purchase list line error:')
  }
}
