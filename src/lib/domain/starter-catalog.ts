import { readFileSync } from 'fs'
import path from 'path'
import { parseCSV } from '@/lib/utils/csv'
import type { ImportRow } from '@/lib/domain/product-import'

/**
 * Starter catalogs: pre-built product lists that seed a brand-new shop, so a
 * shopkeeper who has been running from memory is not asked to hand-type a
 * thousand items before their first sale.
 *
 * Each catalog is a plain CSV in `data/starter-catalogs/`, generated from a
 * curated real shop via `scripts/export-catalog.ts`. Keeping them as files (not
 * DB rows) means every change is reviewable in a git diff before it reaches a
 * customer, and refreshing one is a re-export, not a migration.
 *
 * Seeding always goes through importProducts(), so dedup, validation and
 * permission rules stay in exactly one place.
 */

/** Column order for generated catalog files. Mirrors the import template. */
export const CATALOG_HEADERS = [
  'name', 'price', 'unit', 'barcode', 'category', 'cartonSize', 'reorderLevel', 'trackStock',
]

/**
 * OrganizationType -> catalog slug. Several verticals share one file: a
 * kiryana, a general store and a convenience store stock much the same FMCG.
 */
const CATALOG_BY_ORG_TYPE: Record<string, string> = {
  KIRYANA_STORE: 'kiryana-store',
  GENERAL_STORE: 'kiryana-store',
  CONVENIENCE_STORE: 'kiryana-store',
  SUPERMARKET: 'kiryana-store',
  RETAIL_STORE: 'kiryana-store',
  HARDWARE_STORE: 'hardware-store',
  SANITARY_STORE: 'hardware-store',
}

const CATALOG_LABELS: Record<string, string> = {
  'kiryana-store': 'Kiryana / general store',
  'hardware-store': 'Hardware / sanitary',
}

export interface StarterCatalog {
  slug: string
  label: string
  rows: ImportRow[]
}

export function catalogSlugForOrgType(orgType?: string | null): string | null {
  if (!orgType) return null
  return CATALOG_BY_ORG_TYPE[orgType] ?? null
}

/** Reads and parses a catalog file. Returns null when the file isn't shipped yet. */
export function loadCatalog(slug: string): StarterCatalog | null {
  // Guard the path: slug reaches this from a request in the API route.
  if (!/^[a-z0-9-]+$/.test(slug) || !CATALOG_LABELS[slug]) return null

  let text: string
  try {
    text = readFileSync(
      path.join(process.cwd(), 'data', 'starter-catalogs', `${slug}.csv`),
      'utf8'
    )
  } catch {
    return null
  }

  const known = new Set(CATALOG_HEADERS)
  const rows = parseCSV(text)
    .map((raw) => {
      const out: Record<string, string> = {}
      for (const key of Object.keys(raw)) {
        if (known.has(key)) out[key] = raw[key]
      }
      return out as ImportRow
    })
    .filter((r) => String(r.name ?? '').trim())

  if (rows.length === 0) return null
  return { slug, label: CATALOG_LABELS[slug], rows }
}

/** The catalog offered to a shop, based on its org's vertical. */
export function catalogForOrgType(orgType?: string | null): StarterCatalog | null {
  const slug = catalogSlugForOrgType(orgType)
  return slug ? loadCatalog(slug) : null
}
