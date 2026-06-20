import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db/prisma'
import type { PaymentMethod } from '@prisma/client'

const METHODS: PaymentMethod[] = ['CASH', 'CARD', 'OTHER']

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const customerId = params.id

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
    const methodRaw = formData.get('method')
    const noteRaw = formData.get('note')

    const amount =
      typeof amountRaw === 'string' && amountRaw.trim() !== '' ? Number(amountRaw) : 0
    const note =
      typeof noteRaw === 'string' && noteRaw.trim() !== '' ? noteRaw.trim() : null

    const method =
      typeof methodRaw === 'string' && METHODS.includes(methodRaw as PaymentMethod)
        ? (methodRaw as PaymentMethod)
        : 'CASH'

    if (!amount || isNaN(amount) || amount <= 0) {
      return NextResponse.redirect(new URL(`/store/customers/${customerId}`, request.url))
    }

    const customer = await prisma.customer.findUnique({ where: { id: customerId } })
    if (!customer || customer.shopId !== user.currentShopId) {
      return NextResponse.redirect(new URL('/store/customers', request.url))
    }

    await prisma.$transaction(async (tx) => {
      await tx.payment.create({
        data: {
          shopId: user.currentShopId!,
          customerId,
          amount,
          method,
          note,
          receivedById: user.id,
        },
      })

      await tx.customerLedger.create({
        data: {
          shopId: user.currentShopId!,
          customerId,
          type: 'PAYMENT_RECEIVED',
          direction: 'CREDIT',
          amount,
          refType: 'payment',
          refId: null,
        },
      })
    })

    return NextResponse.redirect(new URL(`/store/customers/${customerId}`, request.url))
  } catch (error) {
    console.error('Udhaar payment error:', error)
    return NextResponse.redirect(new URL(`/store/customers/${customerId}`, request.url))
  }
}
