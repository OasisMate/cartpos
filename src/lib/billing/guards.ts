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
import { countSeats, newSeatStartsPaused } from './seats'

export interface BillingUser {
  billing?: BillingState | null
  currentShopId?: string | null
  currentOrgId?: string | null
  shops?: Array<{
    shopId: string
    /** This person's seat for that shop. False = paused by a plan downgrade. */
    seatActive?: boolean | null
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

    // The shop is open but THIS person's seat is not. A downgrade paused seats that no
    // longer fit the plan; they keep their login and can read everything, so a cashier is
    // never locked out of the building, but they cannot ring up a sale until the owner
    // upgrades. Same `explicit false` rule: undefined means the flag was not loaded.
    if (entry?.seatActive === false) {
      return PaymentRequiredResponse(
        'Your account is paused because the plan was downgraded. Ask the shop owner to upgrade so you can sell again.',
        'SEAT_PAUSED'
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
 * Explains why a cap is being hit when paused seats are part of the reason.
 *
 * Without this the owner reads "your plan includes 3 users", counts two people who can
 * actually sell, and concludes the app is broken. Paused accounts are invisible on the
 * shop floor but they still occupy seats, so the message has to say so, and has to name
 * the two ways out.
 */
function pausedSeatNote(paused: number): string {
  if (paused <= 0) return ''
  return paused === 1
    ? ' 1 paused account still uses a seat. Upgrade, or remove that person, to free it.'
    : ` ${paused} paused accounts still use seats. Upgrade, or remove those people, to free them.`
}

/**
 * Seat cap, checked when adding someone to the org.
 *
 * Never consulted at login: hitting the cap stops the next hire and nothing else, so an
 * existing user is never signed out by it. What a paused seat DOES do is turn that person
 * read-only (see requirePaidWrite) while still counting here, because pausing is a prompt
 * to upgrade rather than a way to shed seats.
 *
 * Counts people, not membership rows. `candidateUserId` is the person being added when
 * they may already hold a seat in this org (the assign-store path): putting someone in a
 * second shop is not a second seat, so the cap must not fire for them.
 */
export async function assertSeatAvailable(
  user: BillingUser,
  orgId: string,
  role: 'STORE_MANAGER' | 'CASHIER',
  candidateUserId?: string
): Promise<Response | null> {
  const billing = user.billing ?? FULL_ACCESS
  if (!billing.enforced || billing.bypass) return null
  if (billing.maxUsers === null && billing.maxCashiers === null) return null

  try {
    // Paused rows included on purpose. Filtering them out was the leak: a downgrade
    // paused staff who kept working, their seats read as free, and the owner could hire
    // replacements into them.
    const seats = await prisma.userShop.findMany({
      where: { shop: { orgId } },
      select: { userId: true, shopRole: true, isActive: true },
    })
    const count = countSeats(seats)
    const note = pausedSeatNote(count.paused)

    const alreadySeated = Boolean(candidateUserId) && seats.some((s) => s.userId === candidateUserId)

    if (!alreadySeated && billing.maxUsers !== null && count.total >= billing.maxUsers) {
      return PaymentRequiredResponse(
        (billing.maxUsers === 1
          ? `${billing.planName} is a single-user plan. Upgrade to Team to add cashiers.`
          : `${billing.planName} includes ${billing.maxUsers} users. Upgrade to add more.`) + note,
        'PLAN_LIMIT'
      )
    }

    if (role === 'CASHIER' && billing.maxCashiers !== null) {
      const alreadyCashier =
        Boolean(candidateUserId) &&
        seats.some((s) => s.userId === candidateUserId && s.shopRole === 'CASHIER')
      if (!alreadyCashier && count.cashiers >= billing.maxCashiers) {
        return PaymentRequiredResponse(
          (billing.maxCashiers === 0
            ? `${billing.planName} does not include cashier accounts. Upgrade to Team to add up to 2.`
            : `${billing.planName} includes ${billing.maxCashiers} cashiers. Upgrade to add more.`) +
            pausedSeatNote(count.pausedCashiers),
          'PLAN_LIMIT'
        )
      }
    }

    return null
  } catch {
    return null // fail open
  }
}

/**
 * Whether a new membership row for `userId` in this org must start paused, and what their
 * existing memberships look like.
 *
 * Used by the assign-store path. A person whose every seat is paused is not covered by
 * the plan, so giving them another store must not quietly hand them a working seat back.
 */
export async function resolveNewSeatState(
  orgId: string,
  userId: string
): Promise<{ startsPaused: boolean; alreadySeated: boolean }> {
  const existing = await prisma.userShop.findMany({
    where: { userId, shop: { orgId } },
    select: { isActive: true },
  })
  return {
    startsPaused: newSeatStartsPaused(existing),
    alreadySeated: existing.length > 0,
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
