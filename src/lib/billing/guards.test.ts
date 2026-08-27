import { describe, it, expect } from 'vitest'
import { requirePaidWrite, canWriteNow } from './guards'
import { FULL_ACCESS } from './subscription'
import type { BillingState } from './subscription'

/**
 * requirePaidWrite is the single choke point that decides whether a write is allowed, so
 * it is where a paused seat has to bite. It is pure, so every rule below is checked
 * without a database.
 */

const enforced = (over: Partial<BillingState> = {}): BillingState => ({
  ...FULL_ACCESS,
  enforced: true,
  bypass: false,
  canWrite: true,
  maxUsers: 3,
  planName: 'Team',
  ...over,
})

async function bodyOf(res: Response) {
  return (await res.json()) as { error: string; code: string }
}

const user = (over: any = {}) => ({
  billing: enforced(),
  currentShopId: 'shop1',
  shops: [{ shopId: 'shop1', seatActive: true, shop: { isActive: true, pausedReason: null } }],
  ...over,
})

describe('a healthy seat', () => {
  it('allows the write', () => {
    expect(requirePaidWrite(user())).toBeNull()
    expect(canWriteNow(user())).toBe(true)
  })
})

describe('a paused seat', () => {
  const paused = () =>
    user({
      shops: [{ shopId: 'shop1', seatActive: false, shop: { isActive: true, pausedReason: null } }],
    })

  it('refuses the write with 402', async () => {
    const res = requirePaidWrite(paused())
    expect(res).not.toBeNull()
    expect(res!.status).toBe(402)
  })

  it('says SEAT_PAUSED, so the client can tell it apart from an expired plan', async () => {
    const res = requirePaidWrite(paused())!
    expect((await bodyOf(res)).code).toBe('SEAT_PAUSED')
  })

  it('tells the reader who can actually fix it', async () => {
    const res = requirePaidWrite(paused())!
    expect((await bodyOf(res)).error).toContain('shop owner')
  })

  it('blocks even though the subscription itself is perfectly current', () => {
    // The org is paid up; this one person is simply outside what the plan covers.
    expect(requirePaidWrite(paused())).not.toBeNull()
  })

  it('reports as not writable to server components', () => {
    expect(canWriteNow(paused())).toBe(false)
  })
})

describe('what a paused seat must NOT do', () => {
  it('does not bite when billing is not enforced', () => {
    const u = user({
      billing: enforced({ enforced: false }),
      shops: [{ shopId: 'shop1', seatActive: false, shop: { isActive: true } }],
    })
    expect(requirePaidWrite(u)).toBeNull()
  })

  it('does not bite in a demo or exempt org', () => {
    // bypass covers demo fixtures and billing-exempt orgs, which never downgrade anyway.
    const u = user({
      billing: enforced({ bypass: true }),
      shops: [{ shopId: 'shop1', seatActive: false, shop: { isActive: true } }],
    })
    expect(requirePaidWrite(u)).toBeNull()
  })

  it('does not bite when the flag was never loaded', () => {
    // Same rule as the shop freeze: only an explicit false blocks. A caller that did not
    // select the column must not accidentally lock everyone out.
    const u = user({ shops: [{ shopId: 'shop1', shop: { isActive: true } }] })
    expect(requirePaidWrite(u)).toBeNull()
  })

  it('does not leak across shops', () => {
    // Paused in shop2, working in shop1. Selling in shop1 must still work.
    const u = user({
      shops: [
        { shopId: 'shop1', seatActive: true, shop: { isActive: true } },
        { shopId: 'shop2', seatActive: false, shop: { isActive: true } },
      ],
    })
    expect(requirePaidWrite(u)).toBeNull()
    expect(requirePaidWrite(u, 'shop2')).not.toBeNull()
  })

  it('does not bite when no shop is in context', () => {
    const u = user({ currentShopId: null })
    expect(requirePaidWrite(u)).toBeNull()
  })
})

describe('which message wins', () => {
  it('a frozen shop beats a paused seat', async () => {
    // Everyone is stopped, not just this person, so the shop-level explanation is the
    // useful one.
    const u = user({
      shops: [
        { shopId: 'shop1', seatActive: false, shop: { isActive: false, pausedReason: 'PLAN_DOWNGRADE' } },
      ],
    })
    const res = requirePaidWrite(u)!
    expect((await bodyOf(res)).code).toBe('SHOP_PAUSED')
  })

  it('a paused seat beats an expired subscription', async () => {
    // More specific to the person reading it.
    const u = user({
      billing: enforced({ canWrite: false, blockedReason: 'Your subscription has expired.' }),
      shops: [{ shopId: 'shop1', seatActive: false, shop: { isActive: true } }],
    })
    const res = requirePaidWrite(u)!
    expect((await bodyOf(res)).code).toBe('SEAT_PAUSED')
  })

  it('still reports an expired subscription for an active seat', async () => {
    const u = user({
      billing: enforced({ canWrite: false, blockedReason: 'Your subscription has expired.' }),
    })
    const res = requirePaidWrite(u)!
    expect((await bodyOf(res)).code).toBe('BILLING_EXPIRED')
  })
})
