import { prisma } from '@/lib/db/prisma'
import { Prisma } from '@prisma/client'
import { createSale, type SaleItemInput } from './sales'

const D = (n: number | string) => new Prisma.Decimal(n)
const round2 = (n: number) => Math.round(n * 100) / 100

/** Quotations are pre-sales: same access level as sales (manager or cashier). */
async function checkPermission(userId: string, shopId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { shops: { where: { shopId } } },
  })
  if (!user) return false
  if (user.role === 'PLATFORM_ADMIN') return true
  const us = user.shops.find((s) => s.shopId === shopId)
  return us?.shopRole === 'STORE_MANAGER' || us?.shopRole === 'CASHIER'
}

export interface CreateQuotationInput {
  customerId?: string | null
  customerName?: string | null
  items: SaleItemInput[]
  subtotal: number
  discount: number
  total: number
  validUntil?: string | null
  note?: string | null
}

async function nextQuotationNumber(tx: Prisma.TransactionClient, shopId: string): Promise<string> {
  const last = await tx.quotation.findFirst({
    where: { shopId },
    orderBy: { createdAt: 'desc' },
    select: { number: true },
  })
  let next = 1
  if (last?.number) {
    const n = parseInt(last.number.replace(/\D/g, ''), 10)
    if (!isNaN(n)) next = n + 1
  }
  return 'Q' + String(next).padStart(6, '0')
}

export async function createQuotation(shopId: string, input: CreateQuotationInput, userId: string) {
  if (!(await checkPermission(userId, shopId))) {
    throw new Error('You do not have permission to create quotations in this shop')
  }
  if (!input.items?.length) throw new Error('Quotation must have at least one item')

  // Validate products belong to the shop.
  const ids = input.items.map((i) => i.productId)
  const products = await prisma.product.findMany({ where: { id: { in: ids }, shopId }, select: { id: true } })
  if (products.length !== new Set(ids).size) throw new Error('One or more products not found in this shop')

  for (const it of input.items) {
    if (!Number.isFinite(it.quantity) || it.quantity <= 0) throw new Error('All items need a quantity greater than 0')
    if (!Number.isFinite(it.unitPrice) || it.unitPrice < 0) throw new Error('Invalid item price')
    if (Math.abs(it.lineTotal - it.quantity * it.unitPrice) > 0.01) throw new Error('Line total mismatch')
  }
  const calcSubtotal = round2(input.items.reduce((s, i) => s + i.lineTotal, 0))
  const total = round2(calcSubtotal - (input.discount || 0))
  if (input.discount < 0) throw new Error('Invalid discount')

  if (input.customerId) {
    const c = await prisma.customer.findFirst({ where: { id: input.customerId, shopId }, select: { id: true } })
    if (!c) throw new Error('Invalid customer')
  }

  return prisma.$transaction(async (tx) => {
    const number = await nextQuotationNumber(tx, shopId)
    return tx.quotation.create({
      data: {
        shopId,
        customerId: input.customerId || null,
        customerName: input.customerName?.trim() || null,
        number,
        subtotal: D(calcSubtotal),
        discount: D(input.discount || 0),
        total: D(total),
        validUntil: input.validUntil ? new Date(input.validUntil) : null,
        note: input.note?.trim() || null,
        createdByUserId: userId,
        lines: {
          create: input.items.map((i) => ({
            productId: i.productId,
            quantity: D(i.quantity),
            unitPrice: D(i.unitPrice),
            lineTotal: D(i.lineTotal),
          })),
        },
      },
      include: { lines: true },
    })
  })
}

export async function listQuotations(shopId: string, filters: { status?: string; search?: string } = {}) {
  const where: Prisma.QuotationWhereInput = { shopId }
  if (filters.status && filters.status !== 'ALL') where.status = filters.status as any
  if (filters.search) {
    where.OR = [
      { number: { contains: filters.search, mode: 'insensitive' } },
      { customerName: { contains: filters.search, mode: 'insensitive' } },
      { customer: { name: { contains: filters.search, mode: 'insensitive' } } },
    ]
  }
  return prisma.quotation.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { customer: { select: { name: true } }, _count: { select: { lines: true } } },
    take: 200,
  })
}

export async function getQuotation(shopId: string, id: string) {
  const q = await prisma.quotation.findFirst({
    where: { id, shopId },
    include: {
      lines: { include: { product: { select: { name: true, unit: true } } } },
      customer: { select: { id: true, name: true, phone: true } },
      shop: { select: { name: true } },
    },
  })
  if (!q) throw new Error('Quotation not found')
  return q
}

export interface ConvertInput {
  paymentStatus: 'PAID' | 'UDHAAR'
  paymentMethod?: 'CASH' | 'CARD' | 'OTHER'
}

export async function convertQuotation(shopId: string, id: string, userId: string, input: ConvertInput) {
  if (!(await checkPermission(userId, shopId))) {
    throw new Error('You do not have permission to convert quotations in this shop')
  }
  const q = await prisma.quotation.findFirst({ where: { id, shopId }, include: { lines: true } })
  if (!q) throw new Error('Quotation not found')
  if (q.status !== 'OPEN') throw new Error(`Quotation is already ${q.status.toLowerCase()}`)
  if (!q.lines.length) throw new Error('Quotation has no items')

  if (input.paymentStatus === 'UDHAAR' && !q.customerId) {
    throw new Error('Udhaar needs a registered customer on the quotation; use cash/card instead')
  }
  if (input.paymentStatus === 'PAID' && !input.paymentMethod) {
    throw new Error('Choose a payment method')
  }

  const subtotal = round2(Number(q.subtotal))
  const discount = round2(Number(q.discount))
  const base = round2(subtotal - discount)

  // Mirror createSale's card-fee handling so the total validation passes.
  let total = base
  if (input.paymentStatus === 'PAID' && input.paymentMethod === 'CARD') {
    const settings = await prisma.shopSettings.findUnique({ where: { shopId } })
    const pct = Number(settings?.cardFeePercent ?? 0)
    total = round2(base + Math.round(base * pct) / 100)
  }

  const items: SaleItemInput[] = q.lines.map((l) => ({
    productId: l.productId,
    quantity: Number(l.quantity),
    unitPrice: Number(l.unitPrice),
    lineTotal: Number(l.lineTotal),
  }))

  const result = await createSale(
    shopId,
    {
      customerId: q.customerId || undefined,
      items,
      subtotal,
      discount,
      total,
      paymentStatus: input.paymentStatus,
      paymentMethod: input.paymentStatus === 'PAID' ? input.paymentMethod : undefined,
      amountReceived: input.paymentStatus === 'PAID' ? total : undefined,
    },
    userId
  )

  const invoiceId = (result as any).invoice?.id as string
  await prisma.quotation.update({
    where: { id: q.id },
    data: { status: 'CONVERTED', convertedInvoiceId: invoiceId, convertedAt: new Date() },
  })

  return { invoiceId, invoiceNumber: (result as any).invoice?.number ?? null }
}

export async function cancelQuotation(shopId: string, id: string, userId: string) {
  if (!(await checkPermission(userId, shopId))) {
    throw new Error('You do not have permission to cancel quotations in this shop')
  }
  const q = await prisma.quotation.findFirst({ where: { id, shopId }, select: { status: true } })
  if (!q) throw new Error('Quotation not found')
  if (q.status === 'CONVERTED') throw new Error('A converted quotation cannot be cancelled')
  return prisma.quotation.update({ where: { id }, data: { status: 'CANCELLED' } })
}
