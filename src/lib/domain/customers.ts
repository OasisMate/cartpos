import { prisma } from '@/lib/db/prisma'

// Read access to a customer's account: any member of the customer's shop
// (cashiers handle udhaar too, not just managers) or a platform admin.
async function checkCustomerReadAccess(userId: string, shopId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { shops: { where: { shopId } } },
  })
  if (!user) return false
  if (user.role === 'PLATFORM_ADMIN') return true
  return user.shops.length > 0
}

/**
 * Full customer account statement (all ledger entries, newest-first) plus the
 * outstanding balance. Mirrors getSupplierLedger. Balance = DEBIT (owes more)
 * minus CREDIT (owes less); a positive balance means the customer owes the shop.
 */
export async function getCustomerLedger(id: string, userId: string) {
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: { shop: { select: { name: true } } },
  })
  if (!customer) {
    throw new Error('Customer not found')
  }

  const hasAccess = await checkCustomerReadAccess(userId, customer.shopId)
  if (!hasAccess) {
    throw new Error('You do not have permission to view this customer')
  }

  const entries = await prisma.customerLedger.findMany({
    where: { customerId: id },
    orderBy: { createdAt: 'desc' },
  })

  let balance = 0
  for (const e of entries) {
    const amt = Number(e.amount)
    balance += e.direction === 'DEBIT' ? amt : -amt
  }

  return {
    customer: {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      notes: customer.notes,
      shopName: customer.shop?.name ?? null,
    },
    balance,
    entries: entries.map((e) => ({
      id: e.id,
      type: e.type,
      direction: e.direction,
      amount: Number(e.amount),
      refType: e.refType,
      refId: e.refId,
      createdAt: e.createdAt,
    })),
  }
}
