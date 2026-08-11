import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { requirePaidWrite } from '@/lib/billing/guards'
import { createSale, CreateSaleInput } from '@/lib/domain/sales'
import { prisma } from '@/lib/db/prisma'
import { logActivity, ActivityActions, EntityTypes } from '@/lib/audit/activityLog'
import {
  getShopFreezeState,
  acceptsOfflineRecord,
  offlineRejectMessage,
} from '@/lib/billing/shop-state'

interface SyncSaleInput {
  id: string // client-generated ID
  customerId?: string
  items: Array<{
    productId: string
    quantity: number
    unitPrice: number
    lineTotal: number
    unitsPerItem?: number
  }>
  subtotal: number
  discount: number
  serviceCharge?: number
  deliveryCharge?: number
  total: number
  paymentStatus: 'PAID' | 'UDHAAR'
  paymentMethod?: 'CASH' | 'CARD' | 'OTHER'
  amountReceived?: number
  paidNow?: number
  /** Device clock at the moment the cashier rang it up. Decides whether a sale
   *  queued offline predates a shop freeze and therefore really happened. */
  clientCreatedAt?: number | null
}

// POST: Batch sync sales from offline clients
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
      return NextResponse.json(
        { error: 'No shop selected' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const sales: SyncSaleInput[] = body.sales || []

    if (sales.length === 0) {
      return NextResponse.json({ synced: 0, skipped: 0, errors: [] })
    }

    // A frozen shop still accepts sales that happened before the freeze: the
    // money physically changed hands and the drawer has to balance. Anything
    // rung up after it was closed is refused, per record, with a reason the
    // cashier can see rather than a silent drop.
    const freeze = await getShopFreezeState(user.currentShopId)

    const results = {
      synced: 0,
      skipped: 0,
      /** Only genuinely failed sales appear here; skips (idempotent dups) do not. */
      errors: [] as Array<{ id: string; error: string }>,
      /** Client sale IDs that were already on the server (idempotent duplicates). */
      skippedIds: [] as string[],
    }

    for (const sale of sales) {
      try {
        if (!acceptsOfflineRecord(freeze, sale.clientCreatedAt)) {
          results.errors.push({ id: sale.id, error: offlineRejectMessage(freeze!) })
          continue
        }

        const input: CreateSaleInput = {
          clientSaleId: sale.id,
          customerId: sale.customerId || undefined,
          items: sale.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            lineTotal: item.lineTotal,
            unitsPerItem: item.unitsPerItem,
          })),
          subtotal: sale.subtotal,
          discount: sale.discount,
          serviceCharge: sale.serviceCharge ?? 0,
          deliveryCharge: sale.deliveryCharge ?? 0,
          total: sale.total,
          paymentStatus: sale.paymentStatus,
          paymentMethod: sale.paymentMethod,
          amountReceived: sale.amountReceived,
          paidNow: sale.paidNow,
        }

        const saleResult = await createSale(user.currentShopId, input, user.id)
        results.synced++

        if (user.currentOrgId && saleResult.created) {
          await logActivity({
            userId: user.id,
            orgId: user.currentOrgId,
            shopId: user.currentShopId,
            action: ActivityActions.CREATE_SALE,
            entityType: EntityTypes.SALE,
            entityId: saleResult.invoice.id,
            details: {
              number: saleResult.invoice.number,
              total: Number(saleResult.invoice.total),
              paymentStatus: saleResult.invoice.paymentStatus,
              offlineSync: true,
            },
            ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
            userAgent: request.headers.get('user-agent') || null,
          })
        }
      } catch (error: any) {
        if (error.message?.includes('already exists') || error.message?.includes('duplicate')) {
          results.skipped++
          results.skippedIds.push(sale.id)
        } else {
          results.errors.push({
            id: sale.id,
            error: error.message || 'Failed to sync sale',
          })
        }
      }
    }

    return NextResponse.json(results)
  } catch (error: any) {
    // Handle aborted connections gracefully (client disconnected)
    if (error.code === 'ECONNRESET' || error.message?.includes('aborted') || error.name === 'AbortError') {
      // Client disconnected - this is normal, don't log as error
      // Return partial results if available, otherwise empty response
      return NextResponse.json(
        { error: 'Connection aborted', synced: 0, skipped: 0, errors: [] },
        { status: 499 } // 499 Client Closed Request
      )
    }
    
    console.error('Batch sync sales error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to sync sales' },
      { status: 500 }
    )
  }
}
