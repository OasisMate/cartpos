import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db/prisma'

interface SyncPaymentInput {
  id: string
  customerId: string
  amount: number
  method: 'CASH' | 'CARD' | 'OTHER'
  note?: string
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
    const payments: SyncPaymentInput[] = body.sales || body.payments || []
    if (payments.length === 0) {
      return NextResponse.json({ synced: 0, skipped: 0, errors: [] })
    }

    const results = { synced: 0, skipped: 0, errors: [] as Array<{ id: string; error: string }> }

    for (const p of payments) {
      try {
        // Validate customer belongs to shop
        const customer = await prisma.customer.findUnique({ where: { id: p.customerId } })
        if (!customer || customer.shopId !== user.currentShopId) {
          throw new Error('Invalid customer for this shop')
        }

        await prisma.$transaction(async (tx) => {
          // Create Payment row
          await tx.payment.create({
            data: {
              shopId: user.currentShopId!,
              customerId: p.customerId,
              amount: p.amount,
              method: p.method,
              note: p.note || null,
            },
          })

          // Create CustomerLedger CREDIT entry (payment received)
          await tx.customerLedger.create({
            data: {
              shopId: user.currentShopId!,
              customerId: p.customerId,
              type: 'PAYMENT_RECEIVED',
              direction: 'CREDIT',
              amount: p.amount,
              refType: 'payment',
              refId: null,
            },
          })
        })

        results.synced++
      } catch (err: any) {
        results.errors.push({ id: p.id, error: err.message || 'Failed to sync payment' })
      }
    }

    return NextResponse.json(results)
  } catch (error: any) {
    console.error('Batch sync udhaar payments error:', error)
    return NextResponse.json({ error: error.message || 'Failed to sync udhaar payments' }, { status: 500 })
  }
}

