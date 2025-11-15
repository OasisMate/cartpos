import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { createSale, CreateSaleInput } from '@/lib/domain/sales'
import { prisma } from '@/lib/db/prisma'

interface SyncSaleInput {
  id: string // client-generated ID
  customerId?: string
  items: Array<{
    productId: string
    quantity: number
    unitPrice: number
    lineTotal: number
  }>
  subtotal: number
  discount: number
  total: number
  paymentStatus: 'PAID' | 'UDHAAR'
  paymentMethod?: 'CASH' | 'CARD' | 'OTHER'
  amountReceived?: number
}

// POST: Batch sync sales from offline clients
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

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

    const results = {
      synced: 0,
      skipped: 0,
      errors: [] as Array<{ id: string; error: string }>,
    }

    // Process each sale
    for (const sale of sales) {
      try {
        // Check if invoice with this ID already exists (idempotency)
        // Note: Since we're using server-generated IDs, we need to check by client ID
        // For now, we'll just try to create it and handle duplicates at the DB level
        // In a real implementation, you might want to store clientId mapping

        const input: CreateSaleInput = {
          customerId: sale.customerId || undefined,
          items: sale.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            lineTotal: item.lineTotal,
          })),
          subtotal: sale.subtotal,
          discount: sale.discount,
          total: sale.total,
          paymentStatus: sale.paymentStatus,
          paymentMethod: sale.paymentMethod,
          amountReceived: sale.amountReceived,
        }

        // Create sale
        await createSale(user.currentShopId, input, user.id)

        results.synced++
      } catch (error: any) {
        // If it's a duplicate, skip it
        if (error.message?.includes('already exists') || error.message?.includes('duplicate')) {
          results.skipped++
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
    console.error('Batch sync sales error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to sync sales' },
      { status: 500 }
    )
  }
}
