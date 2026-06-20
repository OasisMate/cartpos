import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getCurrentUser } from '@/lib/auth'
import { getOpenShiftId } from '@/lib/domain/shifts'

// GET: recorded (synced) expenses for the current shop, most recent first.
export async function GET(req: NextRequest) {
    try {
        const user = await getCurrentUser()
        if (!user?.currentShopId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const limitParam = Number(req.nextUrl.searchParams.get('limit'))
        const take = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 200) : 100

        const expenses = await prisma.expense.findMany({
            where: { shopId: user.currentShopId },
            orderBy: { date: 'desc' },
            take,
            select: {
                id: true,
                category: true,
                amount: true,
                description: true,
                date: true,
                user: { select: { name: true } },
            },
        })

        return NextResponse.json({
            expenses: expenses.map((e) => ({
                id: e.id,
                category: e.category,
                amount: Number(e.amount),
                description: e.description,
                date: e.date,
                userName: e.user?.name || null,
            })),
        })
    } catch (error: any) {
        console.error('Error listing expenses:', error)
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
    }
}

export async function POST(req: NextRequest) {
    try {
        const user = await getCurrentUser()
        if (!user?.currentShopId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await req.json()
        const { category, amount, description, date, createdAt } = body

        const amt = Number(amount)
        if (!category || !date || !Number.isFinite(amt) || amt <= 0) {
            return NextResponse.json(
                { error: 'Category, date, and a valid positive amount are required' },
                { status: 400 }
            )
        }

        // Attribute the cash out to the recorder's open drawer, if any.
        const shiftId = await getOpenShiftId(prisma, user.currentShopId, user.id)

        // Create Expense entry
        const expense = await prisma.expense.create({
            data: {
                shopId: user.currentShopId,
                userId: user.id,
                category,
                amount: amt,
                description,
                date: new Date(date),
                createdAt: createdAt ? new Date(createdAt) : undefined,
                shiftId,
            },
        })

        return NextResponse.json({ success: true, expense })
    } catch (error: any) {
        console.error('Error creating expense:', error)
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
    }
}
