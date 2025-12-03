import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db/prisma'
import { canManageProducts, hasShopAccess, UnauthorizedResponse, ForbiddenResponse } from '@/lib/permissions'

// GET: Get shop settings
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return UnauthorizedResponse()
    }

    if (!user.currentShopId) {
      return NextResponse.json(
        { error: 'No shop selected' },
        { status: 400 }
      )
    }

    // Check permission - only STORE_MANAGER can view settings
    if (!canManageProducts(user, user.currentShopId)) {
      return ForbiddenResponse('Only Store Managers can view shop settings')
    }

    // Get or create shop settings
    let settings = await prisma.shopSettings.findUnique({
      where: { shopId: user.currentShopId },
    })

    if (!settings) {
      // Create default settings
      settings = await prisma.shopSettings.create({
        data: {
          shopId: user.currentShopId,
          requireCostPriceForStockItems: false,
          requireBarcodeForProducts: false,
          allowCustomUnits: true,
          allowNegativeStock: true,
          languageMode: 'EN_BILINGUAL',
          printerName: null,
          autoPrint: false,
        },
      })
    }

    return NextResponse.json({ settings })
  } catch (error: any) {
    console.error('Get shop settings error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get shop settings' },
      { status: 500 }
    )
  }
}

// PUT: Update shop settings
export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return UnauthorizedResponse()
    }

    if (!user.currentShopId) {
      return NextResponse.json(
        { error: 'No shop selected' },
        { status: 400 }
      )
    }

    // Check permission - only STORE_MANAGER can update settings
    if (!canManageProducts(user, user.currentShopId)) {
      return ForbiddenResponse('Only Store Managers can update shop settings')
    }

    const body = await request.json()
    const {
      printerName,
      autoPrint,
      requireCostPriceForStockItems,
      requireBarcodeForProducts,
      allowCustomUnits,
      allowNegativeStock,
      languageMode,
    } = body

    // Update or create settings
    const settings = await prisma.shopSettings.upsert({
      where: { shopId: user.currentShopId },
      update: {
        ...(printerName !== undefined && { printerName: printerName || null }),
        ...(autoPrint !== undefined && { autoPrint }),
        ...(requireCostPriceForStockItems !== undefined && { requireCostPriceForStockItems }),
        ...(requireBarcodeForProducts !== undefined && { requireBarcodeForProducts }),
        ...(allowCustomUnits !== undefined && { allowCustomUnits }),
        ...(allowNegativeStock !== undefined && { allowNegativeStock }),
        ...(languageMode !== undefined && { languageMode }),
      },
      create: {
        shopId: user.currentShopId,
        printerName: printerName || null,
        autoPrint: autoPrint || false,
        requireCostPriceForStockItems: requireCostPriceForStockItems ?? false,
        requireBarcodeForProducts: requireBarcodeForProducts ?? false,
        allowCustomUnits: allowCustomUnits ?? true,
        allowNegativeStock: allowNegativeStock ?? true,
        languageMode: languageMode || 'EN_BILINGUAL',
      },
    })

    return NextResponse.json({ settings })
  } catch (error: any) {
    console.error('Update shop settings error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update shop settings' },
      { status: 500 }
    )
  }
}


