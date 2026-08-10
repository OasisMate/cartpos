/**
 * Two independent gates, composed.
 *
 *   available = the business type finds it relevant
 *               AND the plan paid for it
 *               AND the subscription still allows writes
 *
 * They answer different questions and must not be confused:
 *   - business type (see lib/domain/business-presets.ts) asks "does a shop like
 *     yours need this at all?" A kiryana store has no use for quotations.
 *   - plan tier asks "did you pay for it?" A Solo surgical trader needs
 *     quotations but has not bought profit reporting.
 *
 * So a kiryana on Business sees no quotations, and a surgical store on Solo
 * sees no profit report, for completely different reasons.
 */
import type { FeatureKey } from './features'
import type { BillingState } from './subscription'

/**
 * Per-shop toggles that decide vertical relevance. This mirrors the `features`
 * object getCurrentUser already builds, so callers pass what they have.
 */
export interface ShopFeatureFlags {
  quotations?: boolean
  tradePricing?: boolean
  unitSplitting?: boolean
  batchExpiry?: boolean
}

/**
 * Features whose relevance depends on the business type. Everything not listed
 * here is universally relevant and gated by plan alone.
 */
const VERTICAL_GATED: Partial<Record<FeatureKey, keyof ShopFeatureFlags>> = {
  quotations: 'quotations',
  tradePricing: 'tradePricing',
  unitSplitting: 'unitSplitting',
  batchExpiry: 'batchExpiry',
}

export interface FeatureContext {
  billing: BillingState
  shopFeatures?: ShopFeatureFlags | null
  /** Set when the current shop is frozen (owner closed it, or a downgrade). */
  shopPaused?: boolean
}

/** Is this capability available to use right now. */
export function canUseFeature(feature: FeatureKey, ctx: FeatureContext): boolean {
  const { billing, shopFeatures } = ctx

  // Vertical relevance first: if a shop like this has no use for it, the plan
  // is irrelevant. Undefined means the flag was not loaded, so do not hide it.
  const flag = VERTICAL_GATED[feature]
  if (flag) {
    const relevant = shopFeatures?.[flag]
    if (relevant === false) return false
  }

  // Kill switch / demo orgs / anything we could not resolve: everything on.
  if (!billing.enforced || billing.bypass) return true

  return billing.features.includes(feature)
}

/**
 * Can they see it but not use it. Drives the read-only banner: the screen still
 * renders and history is readable, only writing is refused.
 */
export function canWriteFeature(feature: FeatureKey, ctx: FeatureContext): boolean {
  if (!canUseFeature(feature, ctx)) return false
  if (ctx.shopPaused) return false
  return ctx.billing.canWrite
}

/**
 * The tier a locked feature belongs to, for the upgrade prompt. Returns null
 * when the feature is not plan-gated (i.e. it was hidden for vertical reasons,
 * where upselling would be nonsense).
 */
export function upgradeTierFor(feature: FeatureKey): 'Team' | 'Business' | null {
  const TEAM_ONLY: FeatureKey[] = [
    'reportsHistory',
    'reportsProfit',
    'reportsByCashier',
    'inviteUsers',
  ]
  const BUSINESS_ONLY: FeatureKey[] = [
    'reportsConsolidated',
    'orgLevel',
    'multiShop',
    'activityLog',
    'csvImport',
  ]
  if (TEAM_ONLY.includes(feature)) return 'Team'
  if (BUSINESS_ONLY.includes(feature)) return 'Business'
  return null
}
