import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { createPurchase, CreatePurchaseInput } from '@/lib/domain/purchases'

interface SyncPurchaseInput {
  id: string
  supplierId?: string
  date?: number
  reference?: string
  notes?: string
  lines: Array<{
    productId: string
    quantity: number
    unitCost?: number
  }>
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
    const purchases: SyncPurchaseInput[] = body.sales || body.purchases || []
    if (purchases.length === 0) {
      return NextResponse.json({ synced: 0, skipped: 0, errors: [] })
    }

    const results = { synced: 0, skipped: 0, errors: [] as Array<{ id: string; error: string }> }

    for (const p of purchases) {
      try {
        const input: CreatePurchaseInput = {
          supplierId: p.supplierId || undefined,
          date: p.date ? new Date(p.date) : undefined,
          reference: p.reference,
          notes: p.notes,
          lines: p.lines.map((l) => ({
            productId: l.productId,
            quantity: l.quantity,
            unitCost: l.unitCost,
          })),
        }

        await createPurchase(user.currentShopId, input, user.id)
        results.synced++
      } catch (err: any) {
        // duplicate or validation errors will be recorded
        results.errors.push({ id: p.id, error: err.message || 'Failed to sync purchase' })
      }
    }

    return NextResponse.json(results)
  } catch (error: any) {
    console.error('Batch sync purchases error:', error)
    return NextResponse.json({ error: error.message || 'Failed to sync purchases' }, { status: 500 })
  }
}

