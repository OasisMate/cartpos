/**
 * Shop freeze checks for write routes, including the offline replay rule.
 *
 * CartPOS is offline-first. A cashier can be disconnected for hours with real
 * sales queued on the device, and during that window the owner may close the
 * shop or a downgrade may park it. When those records finally reach us we have
 * to decide, per record, whether they count.
 *
 * The rule: a record created BEFORE the shop was frozen actually happened, and
 * refusing it would destroy a real transaction and leave the drawer short.
 * A record created after did not happen and must be refused. Never drop either
 * silently, always say which and why.
 */
import { prisma } from '@/lib/db/prisma'

export interface ShopFreezeState {
  isActive: boolean
  pausedAt: Date | null
  pausedReason: string | null
  name: string
}

export async function getShopFreezeState(shopId: string): Promise<ShopFreezeState | null> {
  try {
    return await prisma.shop.findUnique({
      where: { id: shopId },
      select: { isActive: true, pausedAt: true, pausedReason: true, name: true },
    })
  } catch {
    return null // fail open: caller treats null as "not frozen"
  }
}

/** Human-readable reason a frozen shop refuses writes. */
export function freezeMessage(state: ShopFreezeState): string {
  return state.pausedReason === 'OWNER_CLOSED'
    ? `${state.name} is closed by the owner. Ask them to reopen it before recording anything new.`
    : `${state.name} is paused because your plan does not cover it. Upgrade to reactivate it.`
}

/**
 * Should a single offline record be accepted into a frozen shop.
 *
 * Accepts when the record predates the freeze. Also accepts when the client
 * sent no timestamp at all: an older app version should not have its sales
 * thrown away because of a field it does not know about yet.
 */
export function acceptsOfflineRecord(
  state: ShopFreezeState | null,
  clientCreatedAt: number | string | null | undefined
): boolean {
  if (!state || state.isActive) return true
  if (!state.pausedAt) return true // frozen but we do not know when: be generous
  if (clientCreatedAt === null || clientCreatedAt === undefined) return true

  const created = typeof clientCreatedAt === 'number' ? clientCreatedAt : Date.parse(String(clientCreatedAt))
  if (!Number.isFinite(created)) return true

  return created < state.pausedAt.getTime()
}

/** The error text for a record refused because it was created after the freeze. */
export function offlineRejectMessage(state: ShopFreezeState): string {
  return state.pausedReason === 'OWNER_CLOSED'
    ? `${state.name} was closed before this was recorded, so it was not saved.`
    : `${state.name} was paused before this was recorded, so it was not saved.`
}
