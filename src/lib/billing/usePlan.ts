'use client'

import { useAuth } from '@/contexts/AuthContext'
import type { FeatureKey } from './features'
import { upgradeTierFor } from './can-use-feature'

/**
 * Client-side view of what the current plan unlocks.
 *
 * UI convenience only. Every one of these decisions is enforced again on the
 * server, so a user who edits their client state gains nothing but a broken
 * screen.
 */
export function usePlan() {
  const { user } = useAuth()
  const billing = user?.billing

  /** Fails open: if billing is off, bypassed or unknown, everything is on. */
  function has(feature: FeatureKey): boolean {
    if (!billing) return true
    if (!billing.enforced || billing.bypass) return true
    return billing.features.includes(feature)
  }

  const currentShop = user?.shops?.find((s) => s.shopId === user?.currentShopId)?.shop
  const shopPaused = currentShop?.isActive === false

  return {
    billing,
    has,
    /** Which tier a locked feature needs, for the upgrade prompt. */
    tierFor: upgradeTierFor,
    planName: billing?.planName ?? 'Business',
    /** True when writes are refused: expired subscription or a frozen shop. */
    readOnly: Boolean(billing && billing.enforced && !billing.bypass && !billing.canWrite) || shopPaused,
    shopPaused,
    isOrgAdmin: Boolean(user?.organizations?.some((o) => o.orgRole === 'ORG_ADMIN')),
  }
}
