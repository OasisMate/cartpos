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

    const sub = org.subscription
    // No subscription row yet (a signup mid-migration, say). Never punish them.
    if (!sub) return { ...FULL_ACCESS, enforced: true }

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

    // Grandfathered: ACTIVE with no period end. Never expires, never warns.
    if (!deadline) {
      return {
        ...base,
        status: inTrial ? 'TRIALING' : 'ACTIVE',
        canWrite: true,
        daysLeft: null,
        deadline: null,
        inTrial: onTrialDeadline,
        inGrace: false,
        blockedReason: '',
      }
    }

    const msLeft = deadline.getTime() - now.getTime()
    const daysLeft = Math.ceil(msLeft / DAY_MS)
    const daysOverdue = -daysLeft

    if (msLeft > 0) {
      return {
        ...base,
        status: inTrial ? 'TRIALING' : 'ACTIVE',
        canWrite: true,
        daysLeft,
        deadline,
        inTrial: onTrialDeadline,
        inGrace: false,
        blockedReason: '',
      }
    }

    // Overdue but inside the grace window: still fully working.
    if (daysOverdue <= GRACE_DAYS) {
      return {
        ...base,
        status: 'PAST_DUE',
        canWrite: true,
        daysLeft,
        deadline,
        inTrial: onTrialDeadline,
        inGrace: true,
        blockedReason: '',
      }
    }

    return {
      ...base,
      status: 'EXPIRED',
      canWrite: false,
      daysLeft,
      deadline,
      inTrial: onTrialDeadline,
      inGrace: false,
      blockedReason: onTrialDeadline
        ? 'Your free trial has ended. Choose a plan to start selling again.'
        : 'Your subscription has expired. Send your payment to start selling again.',
    }
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
