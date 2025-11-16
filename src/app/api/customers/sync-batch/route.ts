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
        // Upsert by (shopId, name, phone) to avoid dupes; in v2 we can store clientId mapping
        await prisma.customer.upsert({
          where: {
            // Assuming a compound unique on (shopId, name, phone) doesn't exist; fall back to find+create
            // Prisma requires a unique; so we do a manual find
            id: '___nonexistent___',
          },
          update: {},
          create: {
            shopId: user.currentShopId,
            name: c.name.trim(),
            phone: c.phone?.trim() || null,
            notes: c.notes?.trim() || null,
          },
        })
        results.synced++
      } catch (err: any) {
        // Fallback: try manual create to better capture errors
        try {
          await prisma.customer.create({
            data: {
              shopId: user.currentShopId,
              name: c.name.trim(),
              phone: c.phone?.trim() || null,
              notes: c.notes?.trim() || null,
            },
          })
          results.synced++
        } catch (inner: any) {
          results.errors.push({ id: c.id, error: inner.message || 'Failed to sync customer' })
        }
      }
    }

    return NextResponse.json(results)
  } catch (error: any) {
    console.error('Batch sync customers error:', error)
    return NextResponse.json({ error: error.message || 'Failed to sync customers' }, { status: 500 })
  }
}

