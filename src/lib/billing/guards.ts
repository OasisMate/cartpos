/**
 * Route guards for the paywall.
 *
 * Usage matches the existing permission helpers, so a route reads:
 *
 *   const user = await getCurrentUser()
 *   if (!user) return UnauthorizedResponse()
 *   const blocked = requirePaidWrite(user)
 *   if (blocked) return blocked
 *
 * These are applied at choke points (sales, sync, purchases, invites, shop
 * creation) rather than on all 74 write handlers: a POS you cannot sell from is
 * blocked, and everything else follows from that. Fewer edits, less risk.
 */
import { prisma } from '@/lib/db/prisma'
import { PaymentRequiredResponse } from '@/lib/permissions'
import type { BillingState } from './subscription'
import { FULL_ACCESS } from './subscription'

export interface BillingUser {
  billing?: BillingState | null
  currentShopId?: string | null
  currentOrgId?: string | null
  shops?: Array<{
    shopId: string
    shop?: { isActive?: boolean | null; pausedReason?: string | null } | null
  }>
}

/**
 * Refuse a write when the subscription is expired or the current shop is
 * frozen. Returns null when the write may proceed.
 *
 * Fails open: a user with no resolved billing state is allowed through.
 */
export function requirePaidWrite(user: BillingUser, shopId?: string | null): Response | null {
  const billing = user.billing ?? FULL_ACCESS
  if (!billing.enforced || billing.bypass) return null

  // Shop-level freeze first: it is the more specific and more confusing state,
  // so it deserves the more specific message.
  const targetShopId = shopId ?? user.currentShopId
  if (targetShopId) {
    const entry = user.shops?.find((s) => s.shopId === targetShopId)
    // Only block on an explicit false. Undefined means we did not load the flag.
    if (entry?.shop?.isActive === false) {
      const byOwner = entry.shop.pausedReason === 'OWNER_CLOSED'
      return PaymentRequiredResponse(
        byOwner
          ? 'This shop is closed by the owner. Ask them to reopen it.'
          : 'This shop is paused. Upgrade your plan to reactivate it.',
        'SHOP_PAUSED'
      )
    }
  }

  if (!billing.canWrite) {
    return PaymentRequiredResponse(billing.blockedReason || 'Your subscription has expired.')
  }

  return null
}

/** Same rule, as a boolean, for server components deciding what to render. */
export function canWriteNow(user: BillingUser, shopId?: string | null): boolean {
  return requirePaidWrite(user, shopId) === null
}

/**
 * Seat cap, checked when INVITING someone.
 *
 * Deliberately never consulted at login. Hitting the cap must stop the next
 * invite and nothing else: an existing user is never logged out, downgraded or
 * blocked mid-shift by this.
 */
export async function assertSeatAvailable(
  user: BillingUser,
  orgId: string,
  role: 'STORE_MANAGER' | 'CASHIER'
): Promise<Response | null> {
  const billing = user.billing ?? FULL_ACCESS
  if (!billing.enforced || billing.bypass) return null
  if (billing.maxUsers === null && billing.maxCashiers === null) return null

  try {
    const seats = await prisma.userShop.findMany({
      where: { shop: { orgId }, isActive: true },
      select: { userId: true, shopRole: true },
    })

    // Distinct people, so someone attached to two shops is one seat.
    const totalUsers = new Set(seats.map((s) => s.userId)).size
    if (billing.maxUsers !== null && totalUsers >= billing.maxUsers) {
      return PaymentRequiredResponse(
        billing.maxUsers === 1
          ? `${billing.planName} is a single-user plan. Upgrade to Team to add cashiers.`
          : `${billing.planName} includes ${billing.maxUsers} users. Upgrade to add more.`,
        'PLAN_LIMIT'
      )
    }

    if (role === 'CASHIER' && billing.maxCashiers !== null) {
      const cashiers = new Set(
        seats.filter((s) => s.shopRole === 'CASHIER').map((s) => s.userId)
      ).size
      if (cashiers >= billing.maxCashiers) {
        return PaymentRequiredResponse(
          billing.maxCashiers === 0
            ? `${billing.planName} does not include cashier accounts. Upgrade to Team to add up to 2.`
            : `${billing.planName} includes ${billing.maxCashiers} cashiers. Upgrade to add more.`,
          'PLAN_LIMIT'
        )
      }
    }

    return null
  } catch {
    return null // fail open
  }
}

/** Shop cap, checked when creating a shop. Extra shops bought explicitly count. */
export async function assertShopAvailable(
  user: BillingUser,
  orgId: string
): Promise<Response | null> {
  const billing = user.billing ?? FULL_ACCESS
  if (!billing.enforced || billing.bypass) return null
  if (billing.maxShops === null) return null

  try {
    const active = await prisma.shop.count({ where: { orgId, isActive: true } })
    const allowance = billing.maxShops + (billing.extraShops ?? 0)
    if (active >= allowance) {
      return PaymentRequiredResponse(
        billing.allowOrgLevel
          ? `Your plan covers ${allowance} shops. Add another shop to your subscription to open one more.`
          : `${billing.planName} is a single-shop plan. Upgrade to Business to run more than one.`,
        'PLAN_LIMIT'
      )
    }
    return null
  } catch {
    return null // fail open
  }
}
