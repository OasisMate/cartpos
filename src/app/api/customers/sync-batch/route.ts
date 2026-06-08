import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db/prisma'

interface SyncCustomerInput {
  id: string
  name: string
  phone?: string | null
  notes?: string | null
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
    const customers: SyncCustomerInput[] = body.sales || body.customers || []
    if (customers.length === 0) {
      return NextResponse.json({ synced: 0, skipped: 0, errors: [] })
    }

    const results = { synced: 0, skipped: 0, errors: [] as Array<{ id: string; error: string }> }

    for (const c of customers) {
      try {
        // Idempotent on (shopId, clientId): re-syncing the same offline customer
        // updates the existing row instead of creating a duplicate.
        await prisma.customer.upsert({
          where: { shopId_clientId: { shopId: user.currentShopId, clientId: c.id } },
          update: {
            name: c.name.trim(),
            phone: c.phone?.trim() || null,
            notes: c.notes?.trim() || null,
          },
          create: {
            shopId: user.currentShopId,
            clientId: c.id,
            name: c.name.trim(),
            phone: c.phone?.trim() || null,
            notes: c.notes?.trim() || null,
          },
        })
        results.synced++
      } catch (err: any) {
        results.errors.push({ id: c.id, error: err.message || 'Failed to sync customer' })
      }
    }

    return NextResponse.json(results)
  } catch (error: any) {
    // Handle aborted connections gracefully (client disconnected)
    if (error.code === 'ECONNRESET' || error.message?.includes('aborted') || error.name === 'AbortError') {
      return NextResponse.json(
        { error: 'Connection aborted', synced: 0, skipped: 0, errors: [] },
        { status: 499 }
      )
    }
    
    console.error('Batch sync customers error:', error)
    return NextResponse.json({ error: error.message || 'Failed to sync customers' }, { status: 500 })
  }
}

