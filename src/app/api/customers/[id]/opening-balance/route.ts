import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db/prisma'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    if (!user.currentShopId) {
      return NextResponse.redirect(new URL('/select-shop', request.url))
    }

    const formData = await request.formData()
    const amountRaw = formData.get('amount')
    const noteRaw = formData.get('note')

    const amount =
      typeof amountRaw === 'string' && amountRaw.trim() !== '' ? Number(amountRaw) : 0
    const note =
      typeof noteRaw === 'string' && noteRaw.trim() !== '' ? noteRaw.trim() : 'Opening balance'

    if (!amount || isNaN(amount) || amount <= 0) {
      return NextResponse.redirect(new URL(`/store/customers/${params.id}`, request.url))
    }

    // Ensure customer belongs to current shop
    const customer = await prisma.customer.findUnique({ where: { id: params.id } })
    if (!customer || customer.shopId !== user.currentShopId) {
      return NextResponse.redirect(new URL('/store/customers', request.url))
    }

    await prisma.customerLedger.create({
      data: {
        shopId: user.currentShopId,
        customerId: params.id,
        type: 'ADJUSTMENT',
        direction: 'DEBIT',
        amount,
        refType: 'opening_balance',
        refId: null,
      },
    })

    return NextResponse.redirect(new URL(`/store/customers/${params.id}`, request.url))
  } catch (error) {
    console.error('Opening balance error:', error)
    return NextResponse.redirect(new URL(`/store/customers/${params.id}`, request.url))
  }
}

