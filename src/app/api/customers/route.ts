import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db/prisma'
import { logActivity, ActivityActions, EntityTypes } from '@/lib/audit/activityLog'
import { validateCustomerFields } from '@/lib/domain/customers'

// GET: List customers for current shop (with optional search/balance filter)
export async function GET(request: NextRequest) {
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

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get('search') || undefined
    const balanceOnly = searchParams.get('balance') === 'true'
    // Clamp to a sane range so a client can't request an unbounded result set.
    const rawLimit = parseInt(searchParams.get('limit') || '500', 10)
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 500) : 500

    const customers = await prisma.customer.findMany({
      where: {
        shopId: user.currentShopId,
        ...(search && {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search } },
          ],
        }),
      },
      orderBy: { name: 'asc' },
      take: limit,
    })

    // Compute balances (DEBIT - CREDIT) for each customer
    const customerIds = customers.map((c) => c.id)
    const [debits, credits] = await Promise.all([
      prisma.customerLedger.groupBy({
        by: ['customerId', 'direction'],
        where: { customerId: { in: customerIds }, direction: 'DEBIT' },
        _sum: { amount: true },
      }),
      prisma.customerLedger.groupBy({
        by: ['customerId', 'direction'],
        where: { customerId: { in: customerIds }, direction: 'CREDIT' },
        _sum: { amount: true },
      }),
    ])

    const debitMap = new Map<string, number>()
    const creditMap = new Map<string, number>()
    debits.forEach((row) => {
      debitMap.set(row.customerId, Number(row._sum.amount || 0))
    })
    credits.forEach((row) => {
      creditMap.set(row.customerId, Number(row._sum.amount || 0))
    })

    let rows = customers.map((c) => {
      const debit = debitMap.get(c.id) ?? 0
      const credit = creditMap.get(c.id) ?? 0
      const balance = debit - credit
      return {
        id: c.id,
        name: c.name,
        phone: c.phone,
        notes: c.notes,
        balance,
      }
    })

    if (balanceOnly) {
      rows = rows.filter((c) => (c.balance || 0) > 0)
    }

    return NextResponse.json({ customers: rows })
  } catch (error: any) {
    console.error('List customers error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to list customers' },
      { status: 500 }
    )
  }
}

// POST: Create a new customer in current shop
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
    const name = (body.name || '').trim()
    const phone = (body.phone || '').trim() || null
    const notes = (body.notes || '').trim() || null
    const openingBalanceRaw = body.openingBalance

    const invalid = await validateCustomerFields(user.currentShopId, name, phone || '')
    if (invalid) {
      const { status, ...payload } = invalid
      return NextResponse.json(payload, { status })
    }

    const openingBalance =
      openingBalanceRaw !== undefined && openingBalanceRaw !== null && openingBalanceRaw !== ''
        ? Number(openingBalanceRaw)
        : 0

    const customer = await prisma.$transaction(async (tx) => {
      const created = await tx.customer.create({
        data: {
          shopId: user.currentShopId!,
          name,
          phone,
          notes,
        },
      })

      if (openingBalance > 0) {
        await tx.customerLedger.create({
          data: {
            shopId: user.currentShopId!,
            customerId: created.id,
            type: 'ADJUSTMENT',
            direction: 'DEBIT',
            amount: openingBalance,
            refType: 'opening_balance',
            refId: null,
          },
        })
      }

      return created
    })

    if (user.currentOrgId) {
      await logActivity({
        userId: user.id,
        orgId: user.currentOrgId,
        shopId: user.currentShopId,
        action: ActivityActions.CREATE_CUSTOMER,
        entityType: EntityTypes.CUSTOMER,
        entityId: customer.id,
        details: { name: customer.name, openingBalance: openingBalance > 0 ? openingBalance : 0 },
        ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
        userAgent: request.headers.get('user-agent') || null,
      })
    }

    return NextResponse.json(
      {
        customer: {
          id: customer.id,
          name: customer.name,
          phone: customer.phone,
          notes: customer.notes,
          balance: openingBalance > 0 ? openingBalance : 0,
        },
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('Create customer error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create customer' },
      { status: 500 }
    )
  }
}
