import type { OrganizationType } from '@prisma/client'

/**
 * The business-type list shown to users, in one place.
 *
 * `Organization.type` (the `OrganizationType` enum) drives feature presets
 * (see `business-presets.ts`). Every dropdown that lets someone pick a business
 * type renders from this file, so adding a vertical is: enum value + migration +
 * preset + one line here. Previously each dropdown had its own hardcoded copy
 * and they drifted apart.
 */
export interface BusinessTypeOption {
  value: OrganizationType
  label: string
}

export interface BusinessTypeGroup {
  label: string
  options: BusinessTypeOption[]
}

export const BUSINESS_TYPE_GROUPS: BusinessTypeGroup[] = [
  {
    label: 'Grocery & General',
    options: [
      { value: 'GENERAL_STORE', label: 'General Store' },
      { value: 'KIRYANA_STORE', label: 'Kiryana / Grocery' },
      { value: 'CONVENIENCE_STORE', label: 'Convenience Store' },
      { value: 'SUPERMARKET', label: 'Supermarket' },
      { value: 'WHOLESALE', label: 'Wholesale' },
      { value: 'RETAIL_STORE', label: 'Retail Store' },
    ],
  },
  {
    label: 'Pharmacy & Health',
    options: [
      { value: 'PHARMACY', label: 'Pharmacy / Medical Store' },
      { value: 'SURGICAL_STORE', label: 'Surgical & Medical Equipment' },
      { value: 'DENTAL_STORE', label: 'Dental Supplies' },
      { value: 'LAB_SUPPLIES', label: 'Lab & Diagnostics' },
      { value: 'VETERINARY_STORE', label: 'Veterinary & Agri-Vet' },
      { value: 'OPTICAL_STORE', label: 'Optical Store' },
    ],
  },
  {
    label: 'Electronics & Mobile',
    options: [
      { value: 'ELECTRONICS_STORE', label: 'Electronics Store' },
      { value: 'MOBILE_ACCESSORIES', label: 'Mobile & Accessories' },
    ],
  },
  {
    label: 'Fashion & Beauty',
    options: [
      { value: 'CLOTHING_STORE', label: 'Clothing / Garments' },
      { value: 'FOOTWEAR_STORE', label: 'Footwear' },
      { value: 'COSMETICS_STORE', label: 'Cosmetics & Beauty' },
      { value: 'JEWELRY_STORE', label: 'Jewellery' },
    ],
  },
  {
    label: 'Home & Hardware',
    options: [
      { value: 'HARDWARE_STORE', label: 'Hardware Store' },
      { value: 'SANITARY_STORE', label: 'Sanitary & Tiles' },
      { value: 'FURNITURE_STORE', label: 'Furniture' },
    ],
  },
  {
    label: 'Food',
    options: [
      { value: 'BAKERY', label: 'Bakery & Sweets' },
      { value: 'RESTAURANT', label: 'Restaurant / Food' },
    ],
  },
  {
    label: 'Other',
    options: [
      { value: 'AUTO_PARTS', label: 'Auto Parts & Accessories' },
      { value: 'STATIONERY_STORE', label: 'Stationery & Books' },
      { value: 'OTHER', label: 'Other' },
    ],
  },
]

/** Flat list of every selectable business type. */
export const BUSINESS_TYPE_OPTIONS: BusinessTypeOption[] = BUSINESS_TYPE_GROUPS.flatMap(
  (g) => g.options
)

const LABELS = new Map(BUSINESS_TYPE_OPTIONS.map((o) => [o.value as string, o.label]))

/** True when the value is a business type we offer. Use before writing to the DB. */
export function isBusinessType(value: unknown): value is OrganizationType {
  return typeof value === 'string' && LABELS.has(value)
}

/**
 * Display name for a stored type. Falls back to title-casing the enum so legacy
 * or newly added values never render as raw SCREAMING_SNAKE.
 */
export function formatOrganizationType(type: string | null | undefined): string {
  if (!type) return 'Not set'
  const known = LABELS.get(type)
  if (known) return known
  return type
    .split('_')
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ')
}
