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
  // Vertical-specific extras live in featureConfig JSON (hybrid), not as columns.
  batchExpiry: boolean
}

/** Typed shape of the ShopSettings.featureConfig JSON bag. Add vertical extras here. */
export interface FeatureConfig {
  batchExpiry?: boolean
  /** Editable per-shop unit list used by the product form. Seeded by business type. */
  units?: string[]
}

/** Safe reader for the featureConfig JSON column (handles null/legacy rows). */
export function readFeatureConfig(json: unknown): FeatureConfig {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return {}
  return json as FeatureConfig
}

// -----------------------------------------------------
// Per-shop units (stored in featureConfig.units, managed in Settings).
// -----------------------------------------------------

/** Fallback unit list (the historical hardcoded set) for lean retail and unknown types. */
export const DEFAULT_UNITS = ['pcs', 'kg', 'g', 'L', 'mL', 'pack', 'box', 'dozen']

/** Starter unit list per business type. Only list types that differ from DEFAULT_UNITS. */
const UNIT_PRESETS: Partial<Record<OrganizationType, string[]>> = {
  PHARMACY: ['tablet', 'capsule', 'strip', 'bottle', 'sachet', 'ml', 'vial', 'tube', 'pen', 'box', 'pcs'],
  RESTAURANT: ['plate', 'item', 'piece', 'cup', 'glass', 'bowl', 'pcs'],
  HARDWARE_STORE: ['pcs', 'ft', 'meter', 'kg', 'bag', 'box', 'roll', 'set', 'pair'],
  SANITARY_STORE: ['pcs', 'ft', 'meter', 'set', 'box', 'roll', 'pair'],
  AUTO_PARTS: ['pcs', 'set', 'pair', 'box', 'L'],
  ELECTRONICS_STORE: ['pcs', 'box', 'set', 'pair', 'unit'],
  MOBILE_ACCESSORIES: ['pcs', 'box', 'set', 'pair', 'unit'],
  FURNITURE_STORE: ['pcs', 'set', 'pair'],
  WHOLESALE: ['pcs', 'kg', 'g', 'carton', 'bag', 'dozen', 'pack', 'box'],
  JEWELRY_STORE: ['pcs', 'gram', 'tola', 'set', 'pair'],
  OPTICAL_STORE: ['pcs', 'pair', 'box', 'set'],
  CLOTHING_STORE: ['pcs', 'pair', 'set', 'dozen', 'meter'],
  FOOTWEAR_STORE: ['pair', 'pcs', 'set', 'box'],
  COSMETICS_STORE: ['pcs', 'bottle', 'tube', 'box', 'pack'],
  STATIONERY_STORE: ['pcs', 'pack', 'box', 'dozen', 'ream', 'set'],
  BAKERY: ['pcs', 'item', 'piece', 'box', 'pack', 'dozen', 'kg'],
}

/** The starter unit list for a business type (falls back to DEFAULT_UNITS). */
export function unitsForType(type: OrganizationType | null | undefined): string[] {
  return (type && UNIT_PRESETS[type]) || DEFAULT_UNITS
}

/** Clean a unit list: trim, drop empties, de-dupe (case-insensitive), cap length + count. */
export function normalizeUnits(list: unknown): string[] {
  if (!Array.isArray(list)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of list) {
    if (typeof raw !== 'string') continue
    const u = raw.trim().slice(0, 24)
    if (!u) continue
    const key = u.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(u)
    if (out.length >= 40) break
  }
  return out
}

/**
 * The units a shop should offer: its saved list if any, else the type preset.
 * Legacy shops with no featureConfig.units transparently get the preset.
 */
export function getShopUnits(
  featureConfig: unknown,
  type: OrganizationType | null | undefined
): string[] {
  const fromCfg = normalizeUnits(readFeatureConfig(featureConfig).units)
  return fromCfg.length ? fromCfg : unitsForType(type)
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
  batchExpiry: false,
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

  // Pharmacy: multi-level packaging (carton/box/tablet) + batch/expiry tracking.
  PHARMACY: { enableUnitSplitting: true, batchExpiry: true },

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
  | 'featureConfig'
> {
  const flags = presetForType(type)
  const featureConfig = { batchExpiry: flags.batchExpiry, units: unitsForType(type) } as Prisma.InputJsonObject
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
    featureConfig,
  }
}
