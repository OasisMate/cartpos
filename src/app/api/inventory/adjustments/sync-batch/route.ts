import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db/prisma'

interface SyncAdjustmentInput {
  id: string
  productId: string
  quantity: number
  type: 'DAMAGE' | 'EXPIRY' | 'RETURN' | 'SELF_USE' | 'ADJUSTMENT'
  notes?: string
  createdAt?: number
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    if (!user.currentShopId) {
      return NextResponse.json({ error: 'No shop selected' }, { status: 400 })
    }

    const body = await request.json()
    const adjustments: SyncAdjustmentInput[] = body.sales || body.adjustments || []
    if (adjustments.length === 0) {
      return NextResponse.json({ synced: 0, skipped: 0, errors: [], skippedIds: [] })
    }

    const results = {
      synced: 0,
      skipped: 0,
      errors: [] as Array<{ id: string; error: string }>,
      skippedIds: [] as string[],
    }

    for (const a of adjustments) {
      try {
        if (!a.productId || a.quantity === undefined || !a.type) {
          throw new Error('Missing required fields')
        }
        const existing = await prisma.stockLedger.findUnique({
          where: { shopId_clientId: { shopId: user.currentShopId, clientId: a.id } },
        })
        if (existing) {
          results.skipped++
          results.skippedIds.push(a.id)
          continue
        }
        await prisma.stockLedger.create({
          data: {
            shopId: user.currentShopId,
            productId: a.productId,
            changeQty: a.quantity,
            type: a.type,
            clientId: a.id,
            createdAt: a.createdAt ? new Date(a.createdAt) : undefined,
          },
        })
        results.synced++
      } catch (err: any) {
        results.errors.push({ id: a.id, error: err.message || 'Failed to sync adjustment' })
      }
    }

    return NextResponse.json(results)
  } catch (error: any) {
    if (error.code === 'ECONNRESET' || error.message?.includes('aborted') || error.name === 'AbortError') {
      return NextResponse.json({ error: 'Connection aborted', synced: 0, skipped: 0, errors: [] }, { status: 499 })
    }
    console.error('Batch sync adjustments error:', error)
    return NextResponse.json({ error: error.message || 'Failed to sync adjustments' }, { status: 500 })
  }
}
