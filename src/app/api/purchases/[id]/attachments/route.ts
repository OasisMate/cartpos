import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getPurchaseAttachments } from '@/lib/domain/purchases'

/**
 * The supplier's bill photos for one purchase. Its own route rather than part
 * of GET /api/purchases/[id] because the images are base64 blobs: the purchases
 * list carries only `_count.attachments`, and this is called when a shopkeeper
 * opens the viewer.
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const attachments = await getPurchaseAttachments(params.id, user.id)

    return NextResponse.json({ attachments })
  } catch (error: any) {
    const message = error.message || 'Failed to load bill photos'
    const status = message.includes('not found') ? 404 : message.includes('permission') ? 403 : 500
    if (status === 500) console.error('Get purchase attachments error:', error)
    return NextResponse.json({ error: message }, { status })
  }
}
