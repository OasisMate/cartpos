import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  resolveBillingState,
  shouldWarn,
  TRIAL_DAYS,
  GRACE_DAYS,
  WARN_DAYS,
  type BillingInput,
} from './subscription'

/**
 * The paywall. `canWrite` here is what decides whether a live shop can ring up a sale, so a
 * mistake in either direction is expensive: too strict and a paying shop is dead at the
 * counter, too loose and everyone works for free.
 *
 * resolveBillingState takes `now`, so every deadline case is exact rather than time-dependent.
 */

const DAY = 24 * 60 * 60 * 1000
const NOW = new Date('2026-08-26T12:00:00Z')
const daysFromNow = (n: number) => new Date(NOW.getTime() + n * DAY)

function org(over: Partial<BillingInput> = {}): BillingInput {
  return {
    status: 'ACTIVE',
    createdAt: daysFromNow(-1),
    subscription: {
      status: 'ACTIVE',
      cycle: 'MONTHLY',
      agreedMonthlyPrice: 2000,
      currentPeriodEnd: daysFromNow(20),
      trialEndsAt: null,
      extraShops: 0,
      plan: { code: 'TEAM', name: 'Team', features: [], maxShops: 1, maxUsers: 3, maxCashiers: 2 },
    } as any,
    ...over,
  }
}

beforeEach(() => {
  process.env.BILLING_ENFORCED = 'true'
})
afterEach(() => {
  delete process.env.BILLING_ENFORCED
})

describe('when the paywall is off', () => {
  it('lets everyone work', () => {
    process.env.BILLING_ENFORCED = 'false'
    const state = resolveBillingState(org({ status: 'SUSPENDED' }), NOW)
    expect(state.canWrite).toBe(true)
    expect(state.enforced).toBe(false)
  })
})

describe('orgs outside billing', () => {
  it('lets a demo org write, so our own testing is never blocked', () => {
    const state = resolveBillingState(org({ isDemo: true }), NOW)
    expect(state.canWrite).toBe(true)
    expect(state.bypass).toBe(true)
  })

  it('lets an admin-granted free org write', () => {
    const state = resolveBillingState(org({ billingExempt: true }), NOW)
    expect(state.canWrite).toBe(true)
    expect(state.bypass).toBe(true)
  })

  it('marks both as enforced, so the admin list still shows billing is on', () => {
    expect(resolveBillingState(org({ isDemo: true }), NOW).enforced).toBe(true)
    expect(resolveBillingState(org({ billingExempt: true }), NOW).enforced).toBe(true)
  })
})

describe('a paid subscription', () => {
  it('can write while the period is running', () => {
    expect(resolveBillingState(org(), NOW).canWrite).toBe(true)
  })

  it('reports the days left until renewal', () => {
    expect(resolveBillingState(org(), NOW).daysLeft).toBe(20)
  })

  it('carries the plan limits through, which the seat caps rely on', () => {
    const state = resolveBillingState(org(), NOW)
    expect(state.planCode).toBe('TEAM')
    expect(state.maxUsers).toBe(3)
    expect(state.maxCashiers).toBe(2)
  })

  it('still writes on the last day of the period', () => {
    const state = resolveBillingState(
      org({ subscription: { ...(org().subscription as any), currentPeriodEnd: daysFromNow(0) } }),
      NOW
    )
    expect(state.canWrite).toBe(true)
  })

  it('keeps writing through the grace window after the period ends', () => {
    const state = resolveBillingState(
      org({
        subscription: { ...(org().subscription as any), currentPeriodEnd: daysFromNow(-1) },
      }),
      NOW
    )
    expect(state.canWrite).toBe(true)
    expect(state.inGrace).toBe(true)
  })

  it('stops writes once the grace window is past', () => {
    const state = resolveBillingState(
      org({
        subscription: {
          ...(org().subscription as any),
          currentPeriodEnd: daysFromNow(-(GRACE_DAYS + 1)),
        },
      }),
      NOW
    )
    expect(state.canWrite).toBe(false)
    expect(state.blockedReason).toBeTruthy()
  })
})

describe('a trial', () => {
  const trialing = (endsIn: number) =>
    org({
      subscription: {
        ...(org().subscription as any),
        status: 'TRIALING',
        currentPeriodEnd: null,
        trialEndsAt: daysFromNow(endsIn),
      } as any,
    })

  it('can write while it runs', () => {
    const state = resolveBillingState(trialing(5), NOW)
    expect(state.canWrite).toBe(true)
    expect(state.inTrial).toBe(true)
  })

  it('keeps writing through grace after it lapses', () => {
    expect(resolveBillingState(trialing(-1), NOW).canWrite).toBe(true)
  })

  it('is cut off once grace runs out', () => {
    // The regression that mattered: a lapsed trial reading its deadline from
    // currentPeriodEnd (null) used to fall through to permanent free access.
    const state = resolveBillingState(trialing(-(GRACE_DAYS + 1)), NOW)
    expect(state.canWrite).toBe(false)
  })
})

describe('orgs with missing data must never get free access forever', () => {
  it('falls back to a trial from the join date when there is no subscription row', () => {
    const state = resolveBillingState(
      org({ subscription: null as any, createdAt: daysFromNow(-1) }),
      NOW
    )
    expect(state.canWrite).toBe(true)
    expect(state.deadline).not.toBeNull()
  })

  it('cuts off a subscription-less org whose join date is long past', () => {
    const state = resolveBillingState(
      org({ subscription: null as any, createdAt: daysFromNow(-(TRIAL_DAYS + GRACE_DAYS + 5)) }),
      NOW
    )
    expect(state.canWrite).toBe(false)
  })

  it('falls back to the join date when the subscription row carries no dates at all', () => {
    const state = resolveBillingState(
      org({
        createdAt: daysFromNow(-(TRIAL_DAYS + GRACE_DAYS + 5)),
        subscription: {
          ...(org().subscription as any),
          status: 'ACTIVE',
          currentPeriodEnd: null,
          trialEndsAt: null,
        } as any,
      }),
      NOW
    )
    expect(state.canWrite).toBe(false)
  })
})

describe('suspended and cancelled', () => {
  it('blocks a suspended org whatever its dates say', () => {
    const state = resolveBillingState(org({ status: 'SUSPENDED' }), NOW)
    expect(state.canWrite).toBe(false)
  })

  it('reports a suspended org as EXPIRED, so admin counters do not hide it under Active', () => {
    expect(resolveBillingState(org({ status: 'SUSPENDED' }), NOW).status).toBe('EXPIRED')
  })

  it('blocks a closed org', () => {
    expect(resolveBillingState(org({ status: 'INACTIVE' }), NOW).canWrite).toBe(false)
  })

  it('blocks a cancelled subscription', () => {
    const state = resolveBillingState(
      org({ subscription: { ...(org().subscription as any), status: 'CANCELLED' } as any }),
      NOW
    )
    expect(state.canWrite).toBe(false)
    expect(state.status).toBe('CANCELLED')
  })
})

describe('failing safe', () => {
  it('lets a shop work when there is no org to judge', () => {
    expect(resolveBillingState(null, NOW).canWrite).toBe(true)
  })

  it('lets a shop work rather than throwing on malformed data', () => {
    const state = resolveBillingState({ subscription: { plan: 'not-an-object' } } as any, NOW)
    expect(state.canWrite).toBe(true)
  })
})

describe('shouldWarn', () => {
  it('warns as the deadline approaches', () => {
    const state = resolveBillingState(
      org({
        subscription: { ...(org().subscription as any), currentPeriodEnd: daysFromNow(WARN_DAYS - 1) },
      }),
      NOW
    )
    expect(shouldWarn(state)).toBe(true)
  })

  it('stays quiet when there is plenty of time', () => {
    expect(shouldWarn(resolveBillingState(org(), NOW))).toBe(false)
  })

  it('stays quiet for an org outside billing', () => {
    expect(shouldWarn(resolveBillingState(org({ isDemo: true }), NOW))).toBe(false)
  })
})
