/**
 * The single place that decides what an organization is allowed to do.
 *
 * DESIGN RULE: FAIL OPEN. Every unknown, every error, every missing row grants
 * full access. Wrongly blocking a live shop mid-sale is a disaster we cannot
 * undo; wrongly allowing a day of unpaid use costs us a few hundred rupees.
 * Nothing in this file may ever throw.
 *
 * Kill switch: unless BILLING_ENFORCED === 'true', this returns full access for
 * everyone, so the whole feature can be deployed dark and switched on only once
 * live traffic has been watched.
 */
import type { BillingCycle, SubscriptionStatus } from '@prisma/client'
import { BUSINESS_FEATURES, PLAN_FEATURES, type FeatureKey } from './features'

/** Days a shop keeps working past its deadline before going read-only. */
export const GRACE_DAYS = 3

/** Length of the free trial every new org gets. */
export const TRIAL_DAYS = 14

/** How early we start warning them in the UI. */
export const WARN_DAYS = 5

const DAY_MS = 24 * 60 * 60 * 1000

export interface BillingState {
  /** Is the paywall switched on at all. */
  enforced: boolean
  /** True when this org is outside billing entirely (demo org, or switch off). */
  bypass: boolean
  planCode: string
  planName: string
  /** Computed from the deadline, not just whatever is stored on the row. */
  status: SubscriptionStatus
  /** True while they may still create/modify records. */
  canWrite: boolean
  /** Null means never expires. Negative means overdue. */
  daysLeft: number | null
  deadline: Date | null
  inTrial: boolean
  /** True during the grace window: overdue but still working. */
  inGrace: boolean
  features: FeatureKey[]
  maxShops: number | null
  maxUsers: number | null
  maxCashiers: number | null
  allowOrgLevel: boolean
  agreedMonthlyPrice: number
  extraShops: number
  extraShopPrice: number | null
  cycle: BillingCycle
  /** Plain-language reason writes are blocked. Empty when they are not. */
  blockedReason: string
}

/** Everything on, nothing gated. The answer whenever we are unsure. */
export const FULL_ACCESS: BillingState = {
  enforced: false,
  bypass: true,
  planCode: 'BUSINESS',
  planName: 'Business',
  status: 'ACTIVE',
  canWrite: true,
  daysLeft: null,
  deadline: null,
  inTrial: false,
  inGrace: false,
  features: BUSINESS_FEATURES,
  maxShops: null,
  maxUsers: null,
  maxCashiers: null,
  allowOrgLevel: true,
  agreedMonthlyPrice: 0,
  extraShops: 0,
  extraShopPrice: null,
  cycle: 'MONTHLY',
  blockedReason: '',
}

export function isBillingEnforced(): boolean {
  return process.env.BILLING_ENFORCED === 'true'
}

/** The shape resolveBillingState needs. Loose on purpose so callers can pass a
 *  Prisma row with extra fields, or a hand-built object in tests. */
export interface BillingInput {
  isDemo?: boolean | null
  billingExempt?: boolean | null
  billingExemptNote?: string | null
  /** Org lifecycle status. A suspended org is blocked whatever its dates say. */
  status?: string | null
  /** Signup date. The fallback deadline is createdAt + TRIAL_DAYS, so an org can
   *  never end up with no deadline at all. */
  createdAt?: Date | null
  subscription?: {
    status: SubscriptionStatus
    cycle: BillingCycle
    agreedMonthlyPrice: unknown // Prisma Decimal
    trialEndsAt: Date | null
    currentPeriodEnd: Date | null
    extraShops: number
    plan?: {
      code: string
      name: string
      features: string[]
      maxShops: number | null
      maxUsers: number | null
      maxCashiers: number | null
      allowOrgLevel: boolean
      extraShopPrice: unknown
    } | null
  } | null
}

function toNumber(v: unknown): number {
  if (v === null || v === undefined) return 0
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/**
 * Turn a single deadline into a state. One place decides writable / grace /
 * read-only, so no caller can accidentally reintroduce a never-expires path.
 *
 * A null deadline means we could not work one out even from the join date, and
 * that is the only case that still fails open.
 */
type DeadlineBase = Omit<
  BillingState,
  'canWrite' | 'daysLeft' | 'deadline' | 'inTrial' | 'inGrace' | 'blockedReason'
> &
  Partial<BillingState>

function deadlineState(
  base: DeadlineBase,
  deadline: Date | null,
  onTrialDeadline: boolean,
  now: Date
): BillingState {
  if (!deadline) {
    return {
      ...base,
      canWrite: true,
      daysLeft: null,
      deadline: null,
      inTrial: onTrialDeadline,
      inGrace: false,
      blockedReason: '',
    }
  }

  const daysLeft = Math.ceil((deadline.getTime() - now.getTime()) / DAY_MS)
  const shared = { ...base, daysLeft, deadline, inTrial: onTrialDeadline }

  if (daysLeft > 0) return { ...shared, canWrite: true, inGrace: false, blockedReason: '' }

  // Overdue but inside the grace window: still fully working.
  if (-daysLeft <= GRACE_DAYS) {
    return { ...shared, status: 'PAST_DUE', canWrite: true, inGrace: true, blockedReason: '' }
  }

  return {
    ...shared,
    status: 'EXPIRED',
    canWrite: false,
    inGrace: false,
    blockedReason: onTrialDeadline
      ? 'Your free trial has ended. Choose a plan to start selling again.'
      : 'Your subscription has expired. Send your payment to start selling again.',
  }
}

/**
 * Work out what an org can do right now.
 *
 * Which field is the deadline depends on status, and getting this backwards
 * would lock out every grandfathered shop:
 *   TRIALING                      -> trialEndsAt
 *   anything else, period null    -> never expires (grandfathered at launch)
 *   anything else, period set     -> currentPeriodEnd
 */
export function resolveBillingState(org: BillingInput | null | undefined, now = new Date()): BillingState {
  try {
    if (!isBillingEnforced()) return FULL_ACCESS
    if (!org) return FULL_ACCESS
    // Demo/QA fixtures are outside billing so our own testing can never be blocked.
    if (org.isDemo) return { ...FULL_ACCESS, enforced: true }
    // Free access granted by an admin. bypass is what hides the plan picker
    // and the payment form, so the owner is never offered a choice that would
    // do nothing.
    if (org.billingExempt) return { ...FULL_ACCESS, enforced: true }

    // The fallback deadline. Nothing is allowed to be deadline-less: an org with
    // no subscription row, or one whose dates are both empty, is treated as
    // having started its trial the day it signed up. Without this there were
    // three separate routes to permanent free access.
    const fallbackDeadline = org.createdAt
      ? new Date(org.createdAt.getTime() + TRIAL_DAYS * DAY_MS)
      : null

    // Suspended or rejected: blocked outright, whatever the dates say. They can
    // still reach the billing page to pay their way back in.
    if (org.status === 'SUSPENDED' || org.status === 'INACTIVE') {
      return {
        ...FULL_ACCESS,
        enforced: true,
        bypass: false,
        // EXPIRED rather than ACTIVE: the admin counters and filters read this,
        // and a suspended org sitting under "Active" is exactly the kind of
        // reporting that hid the problem in the first place.
        status: 'EXPIRED',
        canWrite: false,
        daysLeft: null,
        deadline: null,
        inTrial: false,
        inGrace: false,
        blockedReason:
          org.status === 'SUSPENDED'
            ? 'This account is suspended. Send your payment or contact us to reopen it.'
            : 'This account is closed. Contact us to reopen it.',
      }
    }

    const sub = org.subscription
    // No subscription row (a signup mid-migration, say). They still get exactly
    // the trial they are entitled to, counted from their join date.
    if (!sub) {
      return deadlineState({
        ...FULL_ACCESS,
        enforced: true,
        bypass: false,
        status: 'TRIALING',
      }, fallbackDeadline, true, now)
    }

    const plan = sub.plan
    const planCode = plan?.code ?? 'BUSINESS'
    const features = (plan?.features?.length ? plan.features : PLAN_FEATURES[planCode]) as FeatureKey[]

    const base = {
      enforced: true,
      bypass: false,
      planCode,
      planName: plan?.name ?? planCode,
      features: features ?? BUSINESS_FEATURES,
      maxShops: plan?.maxShops ?? null,
      maxUsers: plan?.maxUsers ?? null,
      maxCashiers: plan?.maxCashiers ?? null,
      allowOrgLevel: plan?.allowOrgLevel ?? true,
      agreedMonthlyPrice: toNumber(sub.agreedMonthlyPrice),
      extraShops: sub.extraShops ?? 0,
      extraShopPrice: plan?.extraShopPrice === null || plan?.extraShopPrice === undefined
        ? null
        : toNumber(plan.extraShopPrice),
      cycle: sub.cycle,
    }

    if (sub.status === 'CANCELLED') {
      return {
        ...base,
        status: 'CANCELLED',
        canWrite: false,
        daysLeft: null,
        deadline: null,
        inTrial: false,
        inGrace: false,
        blockedReason: 'This subscription was cancelled.',
      }
    }

    const inTrial = sub.status === 'TRIALING'
    // A lapsed trial keeps its deadline in trialEndsAt: currentPeriodEnd is only
    // set once somebody actually pays. Reading currentPeriodEnd alone here meant
    // that the moment the sweep moved a trial to PAST_DUE its deadline read as
    // null, it fell into the grandfathered branch below, and every expired trial
    // silently became a permanent free account.
    const deadline = inTrial ? sub.trialEndsAt : sub.currentPeriodEnd ?? sub.trialEndsAt
    // Whether the deadline we ended up with is a trial deadline. Drives the
    // wording, and stays true after the stored status has moved off TRIALING.
    const onTrialDeadline = inTrial || (!sub.currentPeriodEnd && !!sub.trialEndsAt)

    // No dates at all on the row: fall back to the trial from the join date
    // rather than granting permanent access, which is what used to happen.
    return deadlineState(
      { ...base, status: inTrial ? 'TRIALING' : 'ACTIVE' },
      deadline ?? fallbackDeadline,
      onTrialDeadline || !deadline,
      now
    )
  } catch {
    // Something unexpected in the data. Let them work.
    return FULL_ACCESS
  }
}

/** True when the UI should show the "expiring soon" warning. */
export function shouldWarn(state: BillingState): boolean {
  if (!state.enforced || state.bypass) return false
  if (state.daysLeft === null) return false
  return state.daysLeft <= WARN_DAYS
}
