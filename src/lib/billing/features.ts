/**
 * What each plan tier unlocks.
 *
 * Governing rule: **gate by depth, not by damage.** Every tier gets a complete,
 * working product. A higher tier is a larger, different thing, never the same
 * thing with holes in it. Solo's dashboard is "Your shop, today" and it is
 * finished; it is not the Team dashboard with cards greyed out.
 *
 * This matters commercially, not just aesthetically: identical products are
 * rated significantly more unfair when built by stripping a better version than
 * when built up from a smaller one, and the resentment peaks exactly when the
 * tiers look alike and the disabling is visible (Gershoff, Kivetz & Keinan,
 * Journal of Consumer Research, 2012).
 *
 * Plan rows in the DB carry the authoritative list (admins can edit them);
 * PLAN_FEATURES below is the seed and the fallback.
 */

export type FeatureKey =
  // Core selling and record keeping. Every tier, always.
  | 'pos'
  | 'sales'
  | 'products'
  | 'customers'
  | 'udhaar'
  | 'receipts'
  | 'offlineSync'
  | 'shopSettings'
  | 'unitSplitting'
  | 'purchases'
  | 'suppliers'
  | 'supplierStatements'
  | 'stockAdjustments'
  | 'expenses'
  | 'cashDrawers'
  | 'zReport'
  | 'cashbook'
  // Vertical essentials. Deliberately in every tier: for a surgical trader,
  // quoting a hospital IS the core workflow, and for a pharmacy so is expiry.
  // Gating these would be core-function damage, not upselling.
  | 'quotations'
  | 'tradePricing'
  | 'batchExpiry'
  // Reporting, gated by depth.
  | 'reportsToday'
  | 'reportsHistory'
  | 'reportsProfit'
  | 'reportsByCashier'
  | 'reportsConsolidated'
  // Scale.
  | 'inviteUsers'
  | 'orgLevel'
  | 'multiShop'
  | 'activityLog'
  | 'csvImport'

/** Available on every tier including Solo. */
export const BASE_FEATURES: FeatureKey[] = [
  'pos',
  'sales',
  'products',
  'customers',
  'udhaar',
  'receipts',
  'offlineSync',
  'shopSettings',
  'unitSplitting',
  'purchases',
  'suppliers',
  'supplierStatements',
  'stockAdjustments',
  'expenses',
  'cashDrawers',
  'zReport',
  'cashbook',
  'quotations',
  'tradePricing',
  'batchExpiry',
  'reportsToday',
]

/**
 * Team adds the answers an owner with staff needs: what did I actually earn,
 * and which cashier took what cash. Accountability is the real pitch here, not
 * "you may add 2 users" - a shared login is worthless to an owner who suspects
 * skimming, which is also what stops password sharing around the Solo cap.
 */
export const TEAM_FEATURES: FeatureKey[] = [
  ...BASE_FEATURES,
  'reportsHistory',
  'reportsProfit',
  'reportsByCashier',
  'inviteUsers',
]

/** Business adds everything that only matters once there is more than one shop. */
export const BUSINESS_FEATURES: FeatureKey[] = [
  ...TEAM_FEATURES,
  'reportsConsolidated',
  'orgLevel',
  'multiShop',
  'activityLog',
  'csvImport',
]

export const PLAN_FEATURES: Record<string, FeatureKey[]> = {
  SOLO: BASE_FEATURES,
  TEAM: TEAM_FEATURES,
  BUSINESS: BUSINESS_FEATURES,
}

/** Fallback when a plan row is missing or its feature list is empty. */
export const DEFAULT_TRIAL_FEATURES = BUSINESS_FEATURES
