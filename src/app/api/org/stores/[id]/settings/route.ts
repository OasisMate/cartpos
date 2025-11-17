import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getCurrentUser } from '@/lib/auth'
import { logActivity, ActivityActions, EntityTypes } from '@/lib/audit/activityLog'

function ensureOrgAdmin(user: any) {
  const isOrgAdmin = user?.organizations?.some(
    (o: any) => o.orgId === user.currentOrgId && o.orgRole === 'ORG_ADMIN'
  )
  if (!isOrgAdmin && user?.role !== 'PLATFORM_ADMIN') {
    throw new Error('FORBIDDEN')
  }
}

// GET: Get store settings
export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  
  try {
    ensureOrgAdmin(user)
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const storeId = params.id
  const orgId = user.currentOrgId

  if (!orgId) {
    return NextResponse.json({ error: 'No organization selected' }, { status: 400 })
  }

  try {
    // Verify store belongs to org
    const shop = await prisma.shop.findFirst({
      where: {
        id: storeId,
        orgId,
      },
    })

    if (!shop) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    }

    const settings = await prisma.shopSettings.findUnique({
      where: { shopId: storeId },
    })

    if (!settings) {
      // Create default settings if they don't exist
      const defaultSettings = await prisma.shopSettings.create({
        data: {
          shopId: storeId,
          requireCostPriceForStockItems: false,
          requireBarcodeForProducts: false,
          allowCustomUnits: true,
          languageMode: 'EN_BILINGUAL',
        },
      })
      return NextResponse.json({ settings: defaultSettings })
    }

    return NextResponse.json({ settings })
  } catch (error) {
    console.error('Get store settings error:', error)
    return NextResponse.json({ error: 'Failed to fetch store settings' }, { status: 500 })
  }
}

// PUT: Update store settings
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  
  try {
    ensureOrgAdmin(user)
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const storeId = params.id
  const orgId = user.currentOrgId

  if (!orgId) {
    return NextResponse.json({ error: 'No organization selected' }, { status: 400 })
  }

  try {
    // Verify store belongs to org
    const shop = await prisma.shop.findFirst({
      where: {
        id: storeId,
        orgId,
      },
    })

    if (!shop) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    }

    const body = await request.json()
    const {
      requireCostPriceForStockItems,
      requireBarcodeForProducts,
      allowCustomUnits,
      languageMode,
    } = body

    // Get old settings for activity log
    const oldSettings = await prisma.shopSettings.findUnique({
      where: { shopId: storeId },
    })

    // Update or create settings
    const updatedSettings = await prisma.shopSettings.upsert({
      where: { shopId: storeId },
      update: {
        requireCostPriceForStockItems:
          requireCostPriceForStockItems !== undefined
            ? Boolean(requireCostPriceForStockItems)
            : oldSettings?.requireCostPriceForStockItems ?? false,
        requireBarcodeForProducts:
          requireBarcodeForProducts !== undefined
            ? Boolean(requireBarcodeForProducts)
            : oldSettings?.requireBarcodeForProducts ?? false,
        allowCustomUnits:
          allowCustomUnits !== undefined
            ? Boolean(allowCustomUnits)
            : oldSettings?.allowCustomUnits ?? true,
        languageMode: languageMode || oldSettings?.languageMode || 'EN_BILINGUAL',
      },
      create: {
        shopId: storeId,
        requireCostPriceForStockItems: Boolean(requireCostPriceForStockItems ?? false),
        requireBarcodeForProducts: Boolean(requireBarcodeForProducts ?? false),
        allowCustomUnits: Boolean(allowCustomUnits ?? true),
        languageMode: languageMode || 'EN_BILINGUAL',
      },
    })

    // Log activity
    await logActivity({
      userId: user.id,
      orgId,
      shopId: storeId,
      action: ActivityActions.UPDATE_STORE_SETTINGS,
      entityType: EntityTypes.STORE,
      entityId: storeId,
      details: {
        old: oldSettings,
        new: updatedSettings,
      },
    })

    return NextResponse.json({ settings: updatedSettings })
  } catch (error: any) {
    console.error('Update store settings error:', error)
    return NextResponse.json({ error: 'Failed to update store settings' }, { status: 500 })
  }
}

