import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db/prisma'
import { canManageProducts, hasShopAccess, UnauthorizedResponse, ForbiddenResponse } from '@/lib/permissions'
import { presetShopSettingsData } from '@/lib/domain/business-presets'

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

    // Business type drives which feature sections the Settings UI shows (independent
    // of whether a flag is currently on, so a feature can be re-enabled after toggling off).
    const shop = await prisma.shop.findUnique({
      where: { id: user.currentShopId },
      select: { organization: { select: { type: true } } },
    })
    const businessType = shop?.organization?.type ?? null

    if (!settings) {
      // Create default settings, seeding feature flags from the org's business type.
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
          logoUrl: null,
          receiptHeaderDisplay: 'NAME_ONLY',
          cardFeePercent: 0 as any,
          allowCardFeeOverride: false,
          ...presetShopSettingsData(businessType),
        },
      })
    }

    return NextResponse.json({ settings, businessType })
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
      logoUrl,
      receiptHeaderDisplay,
      cardFeePercent,
      allowCardFeeOverride,
      timezone,
      // Business-type feature flags
      enableQuotations,
      enableServiceCharge,
      serviceChargePercent,
      allowServiceChargeOverride,
      enableDeliveryCharge,
      deliveryChargeMode,
      deliveryChargeDefault,
      deliveryChargePercent,
      removeServiceChargeOnDelivery,
      enableUnitSplitting,
    } = body

    // Validate percent fields when provided (0..100).
    for (const [label, val] of [
      ['Service charge percent', serviceChargePercent],
      ['Delivery charge percent', deliveryChargePercent],
    ] as const) {
      if (val !== undefined && val !== null) {
        const pct = Number(val)
        if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
          return NextResponse.json({ error: `${label} must be between 0 and 100` }, { status: 400 })
        }
      }
    }
    // Delivery default amount must be non-negative when provided.
    if (deliveryChargeDefault !== undefined && deliveryChargeDefault !== null) {
      const amt = Number(deliveryChargeDefault)
      if (!Number.isFinite(amt) || amt < 0) {
        return NextResponse.json({ error: 'Delivery charge amount must be 0 or more' }, { status: 400 })
      }
    }
    if (deliveryChargeMode !== undefined && deliveryChargeMode !== 'FIXED' && deliveryChargeMode !== 'PERCENT') {
      return NextResponse.json({ error: 'Invalid delivery charge mode' }, { status: 400 })
    }

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
        ...(logoUrl !== undefined && { logoUrl: logoUrl || null }),
        ...(receiptHeaderDisplay !== undefined && { receiptHeaderDisplay }),
        ...(cardFeePercent !== undefined && { cardFeePercent }),
        ...(allowCardFeeOverride !== undefined && { allowCardFeeOverride }),
        ...(timezone !== undefined && timezone && { timezone }),
        ...(enableQuotations !== undefined && { enableQuotations }),
        ...(enableServiceCharge !== undefined && { enableServiceCharge }),
        ...(serviceChargePercent !== undefined && { serviceChargePercent: serviceChargePercent === null ? null : Number(serviceChargePercent) }),
        ...(allowServiceChargeOverride !== undefined && { allowServiceChargeOverride }),
        ...(enableDeliveryCharge !== undefined && { enableDeliveryCharge }),
        ...(deliveryChargeMode !== undefined && { deliveryChargeMode }),
        ...(deliveryChargeDefault !== undefined && { deliveryChargeDefault: deliveryChargeDefault === null ? null : Number(deliveryChargeDefault) }),
        ...(deliveryChargePercent !== undefined && { deliveryChargePercent: deliveryChargePercent === null ? null : Number(deliveryChargePercent) }),
        ...(removeServiceChargeOnDelivery !== undefined && { removeServiceChargeOnDelivery }),
        ...(enableUnitSplitting !== undefined && { enableUnitSplitting }),
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
        logoUrl: logoUrl || null,
        receiptHeaderDisplay: receiptHeaderDisplay || 'NAME_ONLY',
        cardFeePercent: (cardFeePercent ?? 0) as any,
        allowCardFeeOverride: allowCardFeeOverride ?? false,
        ...(timezone && { timezone }),
        ...(enableQuotations !== undefined && { enableQuotations }),
        ...(enableServiceCharge !== undefined && { enableServiceCharge }),
        ...(serviceChargePercent !== undefined && serviceChargePercent !== null && { serviceChargePercent: Number(serviceChargePercent) }),
        ...(allowServiceChargeOverride !== undefined && { allowServiceChargeOverride }),
        ...(enableDeliveryCharge !== undefined && { enableDeliveryCharge }),
        ...(deliveryChargeMode !== undefined && { deliveryChargeMode }),
        ...(deliveryChargeDefault !== undefined && deliveryChargeDefault !== null && { deliveryChargeDefault: Number(deliveryChargeDefault) }),
        ...(deliveryChargePercent !== undefined && deliveryChargePercent !== null && { deliveryChargePercent: Number(deliveryChargePercent) }),
        ...(removeServiceChargeOnDelivery !== undefined && { removeServiceChargeOnDelivery }),
        ...(enableUnitSplitting !== undefined && { enableUnitSplitting }),
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


