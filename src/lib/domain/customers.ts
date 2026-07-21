import { prisma } from '@/lib/db/prisma'
import { normalizePhone, validatePhone } from '@/lib/validation'

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

// Delete access: only the store manager of the customer's shop (or a platform
// admin). Cashiers can add/edit customers but not delete them.
export async function checkCustomerDeleteAccess(userId: string, shopId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { shops: { where: { shopId } } },
  })
  if (!user) return false
  if (user.role === 'PLATFORM_ADMIN') return true
  return user.shops.some((s) => s.shopRole === 'STORE_MANAGER')
}

export interface CustomerFieldError {
  status: number
  error: string
  existing?: { id: string; name: string; phone: string | null }
}

/**
 * Validate a customer's name + phone and enforce a unique phone within the shop.
 * Phone is required and must be a valid Pakistani number. Uniqueness is compared
 * on the normalized (E.164) form so different raw formats of the same number are
 * caught, but the phone is stored as entered. Pass `excludeId` when editing.
 * Returns null when valid, or a { status, error, existing? } object to return.
 */
export async function validateCustomerFields(
  shopId: string,
  name: string,
  phone: string,
  excludeId?: string
): Promise<CustomerFieldError | null> {
  if (!name) {
    return { status: 400, error: 'Name is required' }
  }
  if (!phone) {
    return { status: 400, error: 'Mobile number is required' }
  }
  if (!validatePhone(phone, 'PK')) {
    return { status: 400, error: 'Enter a valid Pakistani mobile number (e.g. 03001234567)' }
  }

  const target = normalizePhone(phone, 'PK')
  if (target) {
    const others = await prisma.customer.findMany({
      where: { shopId, phone: { not: null }, ...(excludeId && { id: { not: excludeId } }) },
      select: { id: true, name: true, phone: true },
      take: 500,
    })
    const clash = others.find((c) => c.phone && normalizePhone(c.phone, 'PK') === target)
    if (clash) {
      return {
        status: 409,
        error: `This mobile number already belongs to ${clash.name}.`,
        existing: { id: clash.id, name: clash.name, phone: clash.phone },
      }
    }
  }

  return null
}

// Relations that make a customer un-deletable (any real transaction history).
export async function customerHasHistory(customerId: string): Promise<boolean> {
  const [invoices, payments, ledger, saleReturns, quotations] = await Promise.all([
    prisma.invoice.count({ where: { customerId } }),
    prisma.payment.count({ where: { customerId } }),
    prisma.customerLedger.count({ where: { customerId } }),
    prisma.saleReturn.count({ where: { customerId } }),
    prisma.quotation.count({ where: { customerId } }),
  ])
  return invoices + payments + ledger + saleReturns + quotations > 0
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
