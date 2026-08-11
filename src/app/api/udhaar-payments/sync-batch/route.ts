import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { requirePaidWrite } from '@/lib/billing/guards'
import { prisma } from '@/lib/db/prisma'
import { getOpenShiftId } from '@/lib/domain/shifts'
import {
  getShopFreezeState,
  acceptsOfflineRecord,
  offlineRejectMessage,
} from '@/lib/billing/shop-state'

interface SyncPaymentInput {
  id: string
  /** Device clock when it was recorded; decides acceptance into a frozen shop. */
  clientCreatedAt?: number | null
  customerId: string
  amount: number
  method: 'CASH' | 'CARD' | 'OTHER'
  note?: string
  /** Optional: user who took the payment on the device. Falls back to the syncing user. */
  receivedById?: string
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    // Read-only lockout: subscription expired, or this shop is frozen.
    // Fails open when billing is off or could not be resolved.
    const blocked = requirePaidWrite(user)
    if (blocked) return blocked
    if (!user.currentShopId) {
      return NextResponse.json({ error: 'No shop selected' }, { status: 400 })
    }

    const body = await request.json()
    const payments: SyncPaymentInput[] = body.sales || body.payments || []
    if (payments.length === 0) {
      return NextResponse.json({ synced: 0, skipped: 0, errors: [] })
    }

    const results = { synced: 0, skipped: 0, errors: [] as Array<{ id: string; error: string }> }

    // Cash a customer actually handed over before the shop closed still counts.
    const freeze = await getShopFreezeState(user.currentShopId)

    for (const p of payments) {
      try {
        if (!acceptsOfflineRecord(freeze, p.clientCreatedAt)) {
          results.errors.push({ id: p.id, error: offlineRejectMessage(freeze!) })
          continue
        }

        // Validate customer belongs to shop. Offline-created customers sync under a new
        // server id (device id survives as clientId), so accept either and canonicalize.
        const customer = await prisma.customer.findFirst({
          where: {
            shopId: user.currentShopId,
            OR: [{ id: p.customerId }, { clientId: p.customerId }],
          },
        })
        if (!customer) {
          throw new Error('Invalid customer for this shop')
        }
        const customerId = customer.id

        // Idempotency: if this offline payment already synced, skip (don't double-credit).
        const existing = await prisma.payment.findUnique({
          where: { shopId_clientId: { shopId: user.currentShopId, clientId: p.id } },
        })
        if (existing) {
          results.skipped++
          continue
        }

        await prisma.$transaction(async (tx) => {
          const shiftId = await getOpenShiftId(tx, user.currentShopId!, user.id)
          // Create Payment row
          await tx.payment.create({
            data: {
              shopId: user.currentShopId!,
              clientId: p.id,
              customerId,
              amount: p.amount,
              method: p.method,
              note: p.note || null,
              receivedById: p.receivedById || user.id,
              shiftId,
            },
          })

          // Create CustomerLedger CREDIT entry (payment received)
          await tx.customerLedger.create({
            data: {
              shopId: user.currentShopId!,
              customerId,
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
    // Handle aborted connections gracefully (client disconnected)
    if (error.code === 'ECONNRESET' || error.message?.includes('aborted') || error.name === 'AbortError') {
      return NextResponse.json(
        { error: 'Connection aborted', synced: 0, skipped: 0, errors: [] },
        { status: 499 }
      )
    }
    
    console.error('Batch sync udhaar payments error:', error)
    return NextResponse.json({ error: error.message || 'Failed to sync udhaar payments' }, { status: 500 })
  }
}

