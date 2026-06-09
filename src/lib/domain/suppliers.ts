import { prisma } from '@/lib/db/prisma'
import type { PaymentMethod, SupplierEntryType, LedgerDirection } from '@prisma/client'

const PAYMENT_METHODS: PaymentMethod[] = ['CASH', 'CARD', 'OTHER']

export interface CreateSupplierInput {
  name: string
  phone?: string
  address?: string
  notes?: string
}

export interface UpdateSupplierInput extends Partial<CreateSupplierInput> {}

export interface SupplierFilters {
  search?: string
  page?: number
  limit?: number
}

// Check if user has permission to manage suppliers in a shop
async function checkSupplierPermission(userId: string, shopId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      shops: {
        where: { shopId },
      },
    },
  })

  if (!user) return false

  // PLATFORM_ADMIN can access any shop
  if (user.role === 'PLATFORM_ADMIN') return true

  // STORE_MANAGER can manage suppliers in their shop
  const userShop = user.shops.find((us) => us.shopId === shopId)
  return userShop?.shopRole === 'STORE_MANAGER'
}

export async function createSupplier(
  shopId: string,
  input: CreateSupplierInput,
  userId: string
) {
  // Check permission
  const hasPermission = await checkSupplierPermission(userId, shopId)
  if (!hasPermission) {
    throw new Error('You do not have permission to create suppliers in this shop')
  }

  // Validate required fields
  if (!input.name || input.name.trim().length === 0) {
    throw new Error('Supplier name is required')
  }

  // Create supplier
  const supplier = await prisma.supplier.create({
    data: {
      shopId,
      name: input.name.trim(),
      phone: input.phone?.trim() || null,
      address: input.address?.trim() || null,
      notes: input.notes?.trim() || null,
    },
  })

  return supplier
}

export async function updateSupplier(
  id: string,
  input: UpdateSupplierInput,
  userId: string
) {
  // Get supplier to find shop
  const supplier = await prisma.supplier.findUnique({
    where: { id },
  })

  if (!supplier) {
    throw new Error('Supplier not found')
  }

  // Check permission
  const hasPermission = await checkSupplierPermission(userId, supplier.shopId)
  if (!hasPermission) {
    throw new Error('You do not have permission to update this supplier')
  }

  // Validate name if provided
  if (input.name !== undefined && (!input.name || input.name.trim().length === 0)) {
    throw new Error('Supplier name cannot be empty')
  }

  // Update supplier
  const updated = await prisma.supplier.update({
    where: { id },
    data: {
      ...(input.name !== undefined && { name: input.name.trim() }),
      ...(input.phone !== undefined && { phone: input.phone?.trim() || null }),
      ...(input.address !== undefined && { address: input.address?.trim() || null }),
      ...(input.notes !== undefined && { notes: input.notes?.trim() || null }),
    },
  })

  return updated
}

export async function listSuppliers(shopId: string, filters: SupplierFilters = {}) {
  const page = filters.page || 1
  const limit = filters.limit || 50
  const skip = (page - 1) * limit

  const where: any = {
    shopId,
  }

  // Search filter (name, phone)
  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: 'insensitive' } },
      { phone: { contains: filters.search, mode: 'insensitive' } },
    ]
  }

  const [suppliers, total] = await Promise.all([
    prisma.supplier.findMany({
      where,
      orderBy: { name: 'asc' },
      skip,
      take: limit,
      include: {
        _count: {
          select: {
            purchases: true,
          },
        },
      },
    }),
    prisma.supplier.count({ where }),
  ])

  return {
    suppliers,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  }
}

export async function getSupplier(id: string, userId: string) {
  const supplier = await prisma.supplier.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          purchases: true,
        },
      },
    },
  })

  if (!supplier) {
    throw new Error('Supplier not found')
  }

  // Check permission
  const hasPermission = await checkSupplierPermission(userId, supplier.shopId)
  if (!hasPermission) {
    throw new Error('You do not have permission to view this supplier')
  }

  return supplier
}

export async function deleteSupplier(id: string, userId: string) {
  // Get supplier to find shop
  const supplier = await prisma.supplier.findUnique({
    where: { id },
  })

  if (!supplier) {
    throw new Error('Supplier not found')
  }

  // Check permission
  const hasPermission = await checkSupplierPermission(userId, supplier.shopId)
  if (!hasPermission) {
    throw new Error('You do not have permission to delete this supplier')
  }

  // Check if supplier has been used in any purchases
  const purchaseCount = await prisma.purchase.count({
    where: { supplierId: id },
  })

  if (purchaseCount > 0) {
    throw new Error('Cannot delete supplier that has been used in purchases. Consider disabling it instead.')
  }

  // Delete supplier
  await prisma.supplier.delete({
    where: { id },
  })

  return { success: true }
}

// -----------------------------------------------------
// Supplier credit / payables ledger
// Balance owed by the shop = sum(CREDIT) - sum(DEBIT)
//   PURCHASE_CREDIT / OPENING_BALANCE => CREDIT (we owe more)
//   PAYMENT_MADE                      => DEBIT  (we owe less)
// -----------------------------------------------------

export interface SupplierPaymentInput {
  amount: number
  method?: PaymentMethod
  note?: string
}

export interface SupplierCreditInput {
  amount: number
  type?: Extract<SupplierEntryType, 'PURCHASE_CREDIT' | 'OPENING_BALANCE' | 'ADJUSTMENT'>
  note?: string
  refType?: string
  refId?: string
}

/** Fetch a supplier's payables ledger plus running balance owed. */
export async function getSupplierLedger(id: string, userId: string) {
  const supplier = await prisma.supplier.findUnique({
    where: { id },
    include: { shop: { select: { name: true } } },
  })
  if (!supplier) {
    throw new Error('Supplier not found')
  }

  const hasPermission = await checkSupplierPermission(userId, supplier.shopId)
  if (!hasPermission) {
    throw new Error('You do not have permission to view this supplier')
  }

  const entries = await prisma.supplierLedger.findMany({
    where: { supplierId: id },
    orderBy: { createdAt: 'desc' },
    include: { createdBy: { select: { name: true } } },
  })

  let balance = 0
  for (const e of entries) {
    const amt = Number(e.amount)
    balance += e.direction === 'CREDIT' ? amt : -amt
  }

  return {
    supplier: {
      id: supplier.id,
      name: supplier.name,
      phone: supplier.phone,
      address: supplier.address,
      notes: supplier.notes,
      shopName: supplier.shop?.name ?? null,
    },
    balance,
    entries: entries.map((e) => ({
      id: e.id,
      type: e.type,
      direction: e.direction,
      amount: Number(e.amount),
      method: e.method,
      note: e.note,
      refType: e.refType,
      refId: e.refId,
      createdAt: e.createdAt,
      createdByName: e.createdBy?.name ?? null,
    })),
  }
}

/** Record a payment made to the supplier (reduces what the shop owes). */
export async function recordSupplierPayment(
  id: string,
  input: SupplierPaymentInput,
  userId: string
) {
  const supplier = await prisma.supplier.findUnique({ where: { id } })
  if (!supplier) {
    throw new Error('Supplier not found')
  }

  const hasPermission = await checkSupplierPermission(userId, supplier.shopId)
  if (!hasPermission) {
    throw new Error('You do not have permission to manage this supplier')
  }

  const amount = Number(input.amount)
  if (!amount || isNaN(amount) || amount <= 0) {
    throw new Error('Payment amount must be greater than zero')
  }

  const method: PaymentMethod =
    input.method && PAYMENT_METHODS.includes(input.method) ? input.method : 'CASH'

  return prisma.supplierLedger.create({
    data: {
      shopId: supplier.shopId,
      supplierId: id,
      type: 'PAYMENT_MADE',
      direction: 'DEBIT',
      amount,
      method,
      note: input.note?.trim() || null,
      refType: 'payment',
      createdByUserId: userId,
    },
  })
}

/** Record an amount the shop owes a supplier (opening balance, purchase on credit, or adjustment). */
export async function recordSupplierCredit(
  id: string,
  input: SupplierCreditInput,
  userId: string
) {
  const supplier = await prisma.supplier.findUnique({ where: { id } })
  if (!supplier) {
    throw new Error('Supplier not found')
  }

  const hasPermission = await checkSupplierPermission(userId, supplier.shopId)
  if (!hasPermission) {
    throw new Error('You do not have permission to manage this supplier')
  }

  const amount = Number(input.amount)
  if (!amount || isNaN(amount) || amount <= 0) {
    throw new Error('Amount must be greater than zero')
  }

  const type: SupplierEntryType = input.type || 'PURCHASE_CREDIT'
  const direction: LedgerDirection = 'CREDIT'

  return prisma.supplierLedger.create({
    data: {
      shopId: supplier.shopId,
      supplierId: id,
      type,
      direction,
      amount,
      note: input.note?.trim() || null,
      refType: input.refType || null,
      refId: input.refId || null,
      createdByUserId: userId,
    },
  })
}
