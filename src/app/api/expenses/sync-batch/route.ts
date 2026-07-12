import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db/prisma'
import { getOpenShiftId } from '@/lib/domain/shifts'

interface SyncExpenseInput {
  id: string
  category: string
  amount: number
  description?: string | null
  date: number
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
    const expenses: SyncExpenseInput[] = body.sales || body.expenses || []
    if (expenses.length === 0) {
      return NextResponse.json({ synced: 0, skipped: 0, errors: [], skippedIds: [] })
    }

    const results = {
      synced: 0,
      skipped: 0,
      errors: [] as Array<{ id: string; error: string }>,
      skippedIds: [] as string[],
    }

    for (const e of expenses) {
      try {
        const amt = Number(e.amount)
        if (!e.category || !e.date || !Number.isFinite(amt) || amt <= 0) {
          throw new Error('Category, date, and a valid positive amount are required')
        }
        // Idempotency: skip if this offline expense already synced.
        const existing = await prisma.expense.findUnique({
          where: { shopId_clientId: { shopId: user.currentShopId, clientId: e.id } },
        })
        if (existing) {
          results.skipped++
          results.skippedIds.push(e.id)
          continue
        }
        const shiftId = await getOpenShiftId(prisma, user.currentShopId, user.id)
        await prisma.expense.create({
          data: {
            shopId: user.currentShopId,
            userId: user.id,
            clientId: e.id,
            category: e.category,
            amount: amt,
            description: e.description || null,
            date: new Date(e.date),
            createdAt: e.createdAt ? new Date(e.createdAt) : undefined,
            shiftId,
          },
        })
        results.synced++
      } catch (err: any) {
        results.errors.push({ id: e.id, error: err.message || 'Failed to sync expense' })
      }
    }

    return NextResponse.json(results)
  } catch (error: any) {
    if (error.code === 'ECONNRESET' || error.message?.includes('aborted') || error.name === 'AbortError') {
      return NextResponse.json({ error: 'Connection aborted', synced: 0, skipped: 0, errors: [] }, { status: 499 })
    }
    console.error('Batch sync expenses error:', error)
    return NextResponse.json({ error: error.message || 'Failed to sync expenses' }, { status: 500 })
  }
}
