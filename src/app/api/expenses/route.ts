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
        const { category, amount, description, date, createdAt } = body

        if (!category || amount === undefined || !date) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        // Create Expense entry
        const expense = await prisma.expense.create({
            data: {
                shopId: user.currentShopId,
                userId: user.id,
                category,
                amount,
                description,
                date: new Date(date),
                createdAt: createdAt ? new Date(createdAt) : undefined,
            },
        })

        return NextResponse.json({ success: true, expense })
    } catch (error: any) {
        console.error('Error creating expense:', error)
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
    }
}
