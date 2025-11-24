import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getCurrentUser } from '@/lib/auth'

export async function POST(req: NextRequest) {
    try {
        const user = await getCurrentUser()
        if (!user?.currentShopId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await req.json()
        const { productId, quantity, type, createdAt } = body

        if (!productId || quantity === undefined || !type) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        // Create StockLedger entry
        const ledger = await prisma.stockLedger.create({
            data: {
                shopId: user.currentShopId,
                productId,
                changeQty: quantity,
                type,
                createdAt: createdAt ? new Date(createdAt) : undefined,
            },
        })

        return NextResponse.json({ success: true, ledger })
    } catch (error: any) {
        console.error('Error creating stock adjustment:', error)
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
    }
}
