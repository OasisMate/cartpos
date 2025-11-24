import { prisma } from '@/lib/db/prisma'
import { hashPassword } from '@/lib/auth'

export interface CreateShopInput {
  name: string
  city?: string
  orgId: string
  ownerName: string
  ownerEmail: string
  ownerPassword: string
}

export async function createShopWithOwner(input: CreateShopInput, createdByUserId: string) {
  // Validate admin role
  const creator = await prisma.user.findUnique({
    where: { id: createdByUserId },
  })

  if (!creator || creator.role !== 'PLATFORM_ADMIN') {
    throw new Error('Only admins can create shops')
  }

  // Check if owner email already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: input.ownerEmail },
  })

  if (existingUser) {
    throw new Error('User with this email already exists')
  }

  // Hash owner password
  const hashedPassword = await hashPassword(input.ownerPassword)

  // Create shop and owner in a transaction
  const result = await prisma.$transaction(async (tx) => {
    // Create shop
    const shop = await tx.shop.create({
      data: {
        name: input.name,
        city: input.city || null,
        orgId: input.orgId,
      },
    })

    // Create owner user
    // Note: phone and cnic are required for regular users but can be null for admin-created users
    // Admin should provide these when creating shops via UI
    const owner = await tx.user.create({
      data: {
        name: input.ownerName,
        email: input.ownerEmail,
        password: hashedPassword,
        role: 'NORMAL',
        phone: null, // Admin should provide via UI
        cnic: null, // Admin should provide via UI
        isWhatsApp: false,
      },
    })

    // Link user to shop as STORE_MANAGER
    await tx.userShop.create({
      data: {
        userId: owner.id,
        shopId: shop.id,
        shopRole: 'STORE_MANAGER',
      },
    })

    // Create default shop settings
    await tx.shopSettings.create({
      data: {
        shopId: shop.id,
        requireCostPriceForStockItems: false,
        requireBarcodeForProducts: false,
        allowCustomUnits: true,
        allowNegativeStock: true, // Default: allow negative stock
        languageMode: 'EN_BILINGUAL',
      },
    })

    return { shop, owner }
  })

  return result
}

export async function listShops(adminUserId: string) {
  // Validate admin role
  const admin = await prisma.user.findUnique({
    where: { id: adminUserId },
  })

  if (!admin || admin.role !== 'PLATFORM_ADMIN') {
    throw new Error('Only admins can list shops')
  }

  const shops = await prisma.shop.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      organization: true,
      owners: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        where: {
          shopRole: 'STORE_MANAGER',
        },
      },
      _count: {
        select: {
          products: true,
          customers: true,
          invoices: true,
        },
      },
    },
  })

  return shops
}

export async function getUserShops(userId: string) {
  const userShops = await prisma.userShop.findMany({
    where: { userId },
    include: {
      shop: true,
    },
    orderBy: { createdAt: 'asc' },
  })

  return userShops.map((us) => ({
    shopId: us.shopId,
    shopRole: us.shopRole,
    shop: us.shop,
  }))
}
