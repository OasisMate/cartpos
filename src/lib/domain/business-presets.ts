import type { OrganizationType, Prisma, DeliveryChargeMode } from '@prisma/client'

/**
 * Business-type feature presets.
 *
 * `Organization.type` is chosen at signup. These presets seed the per-shop
 * feature flags on ShopSettings so each business only sees the features it needs
 * (e.g. kiryana shops don't get quotations, restaurants get a service charge,
 * pharmacies can sell a loose unit out of a box). The owner can override any
 * flag later in store Settings, so presets are only the starting point.
 *
 * Keep this the single source of truth for type -> default flags.
 */
export interface BusinessFeatureFlags {
  enableQuotations: boolean
  enableServiceCharge: boolean
  serviceChargePercent: number | null
  allowServiceChargeOverride: boolean
  enableDeliveryCharge: boolean
  deliveryChargeMode: DeliveryChargeMode
  deliveryChargeDefault: number | null
  deliveryChargePercent: number | null
  removeServiceChargeOnDelivery: boolean
  enableUnitSplitting: boolean
  enableTradePricing: boolean
}

// Conservative baseline. Anything not explicitly turned on by a type stays off,
// except quotations which historically shipped to every shop.
const DEFAULT_FLAGS: BusinessFeatureFlags = {
  enableQuotations: false,
  enableServiceCharge: false,
  serviceChargePercent: null,
  allowServiceChargeOverride: true,
  enableDeliveryCharge: false,
  deliveryChargeMode: 'FIXED',
  deliveryChargeDefault: null,
  deliveryChargePercent: null,
  removeServiceChargeOnDelivery: true,
  enableUnitSplitting: false,
  enableTradePricing: false,
}

// Typical restaurant service charge in PK; owner can change it in Settings.
const DEFAULT_SERVICE_CHARGE_PERCENT = 5

// Only list the flags that differ from DEFAULT_FLAGS for a given type.
const PRESETS: Partial<Record<OrganizationType, Partial<BusinessFeatureFlags>>> = {
  // Quote-driven trades that also use wholesale/trade pricing.
  HARDWARE_STORE: { enableQuotations: true, enableTradePricing: true },
  SANITARY_STORE: { enableQuotations: true, enableTradePricing: true },
  ELECTRONICS_STORE: { enableQuotations: true, enableTradePricing: true },
  AUTO_PARTS: { enableQuotations: true, enableTradePricing: true },
  FURNITURE_STORE: { enableQuotations: true, enableTradePricing: true },
  WHOLESALE: { enableQuotations: true, enableTradePricing: true },

  // Pharmacy: sell a whole box or a loose unit (tablet) out of it.
  PHARMACY: { enableUnitSplitting: true },

  // Hospitality: service charge on dine-in, optional delivery fee.
  RESTAURANT: {
    enableServiceCharge: true,
    serviceChargePercent: DEFAULT_SERVICE_CHARGE_PERCENT,
    enableDeliveryCharge: true,
    deliveryChargeMode: 'FIXED',
    removeServiceChargeOnDelivery: true,
  },

  // Fast retail / grocery: keep it lean (no quotations).
  KIRYANA_STORE: {},
  RETAIL_STORE: {},
  GENERAL_STORE: {},
  SUPERMARKET: {},
  CONVENIENCE_STORE: {},
}

/**
 * Full feature-flag set for a business type, with type-specific overrides
 * merged over the conservative defaults.
 */
export function presetForType(type: OrganizationType | null | undefined): BusinessFeatureFlags {
  const overrides = (type && PRESETS[type]) || {}
  return { ...DEFAULT_FLAGS, ...overrides }
}

/**
 * Preset shaped for a Prisma ShopSettings create/update. `serviceChargePercent`
 * is a Decimal column, so null stays null and a number is passed through as-is
 * (Prisma accepts number for Decimal inputs).
 */
export function presetShopSettingsData(
  type: OrganizationType | null | undefined
): Pick<
  Prisma.ShopSettingsUncheckedCreateInput,
  | 'enableQuotations'
  | 'enableServiceCharge'
  | 'serviceChargePercent'
  | 'allowServiceChargeOverride'
  | 'enableDeliveryCharge'
  | 'deliveryChargeMode'
  | 'deliveryChargeDefault'
  | 'deliveryChargePercent'
  | 'removeServiceChargeOnDelivery'
  | 'enableUnitSplitting'
  | 'enableTradePricing'
> {
  const flags = presetForType(type)
  return {
    enableQuotations: flags.enableQuotations,
    enableServiceCharge: flags.enableServiceCharge,
    serviceChargePercent: flags.serviceChargePercent,
    allowServiceChargeOverride: flags.allowServiceChargeOverride,
    enableDeliveryCharge: flags.enableDeliveryCharge,
    deliveryChargeMode: flags.deliveryChargeMode,
    deliveryChargeDefault: flags.deliveryChargeDefault,
    deliveryChargePercent: flags.deliveryChargePercent,
    removeServiceChargeOnDelivery: flags.removeServiceChargeOnDelivery,
    enableUnitSplitting: flags.enableUnitSplitting,
    enableTradePricing: flags.enableTradePricing,
  }
}
