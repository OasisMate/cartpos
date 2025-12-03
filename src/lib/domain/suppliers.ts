import { prisma } from '@/lib/db/prisma'

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
