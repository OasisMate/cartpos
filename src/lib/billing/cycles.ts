/**
 * Billing cycles and what they cost.
 *
 * One monthly price per plan, plus this table, gives every cycle. A price
 * change is therefore one number in one place, never twelve.
 *
 * The discounts climb with commitment: quarterly and half-yearly exist because
 * nobody else in the Pakistani POS market offers them and lumpy shop cash flow
 * suits them, and yearly is the standard "pay for 10 months, get 12".
 */
import type { BillingCycle } from '@prisma/client'

export interface CycleSpec {
  /** Months of access this cycle buys. */
  months: number
  /** Fraction off the undiscounted months x price total. */
  discount: number
  /** Shown on the cycle picker. */
  label: string
  /** Short badge, empty when there is nothing to shout about. */
  badge: string
}

export const BILLING_CYCLES: Record<BillingCycle, CycleSpec> = {
  MONTHLY: { months: 1, discount: 0, label: 'Monthly', badge: '' },
  QUARTERLY: { months: 3, discount: 0.05, label: '3 months', badge: 'Save 5%' },
  HALF_YEARLY: { months: 6, discount: 0.1, label: '6 months', badge: 'Save 10%' },
  YEARLY: { months: 12, discount: 0.17, label: '1 year', badge: 'Pay 10, get 12' },
}

export const CYCLE_ORDER: BillingCycle[] = ['MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY']

/** Rounded to whole rupees. Nobody invoices a shopkeeper for paisas. */
export function priceFor(agreedMonthlyPrice: number, cycle: BillingCycle): number {
  const spec = BILLING_CYCLES[cycle] ?? BILLING_CYCLES.MONTHLY
  return Math.round(agreedMonthlyPrice * spec.months * (1 - spec.discount))
}

/** What they save versus paying monthly for the same span. Zero on MONTHLY. */
export function savingsFor(agreedMonthlyPrice: number, cycle: BillingCycle): number {
  const spec = BILLING_CYCLES[cycle] ?? BILLING_CYCLES.MONTHLY
  return Math.round(agreedMonthlyPrice * spec.months) - priceFor(agreedMonthlyPrice, cycle)
}

export function monthsFor(cycle: BillingCycle): number {
  return (BILLING_CYCLES[cycle] ?? BILLING_CYCLES.MONTHLY).months
}

/** Extend a period end by one cycle, counting from whichever is later: the
 *  existing end (so paying early never loses days) or now (so a lapsed shop
 *  does not get billed for the time it was locked out). */
export function extendPeriod(currentEnd: Date | null, cycle: BillingCycle, now = new Date()): Date {
  const base = currentEnd && currentEnd > now ? new Date(currentEnd) : new Date(now)
  base.setMonth(base.getMonth() + monthsFor(cycle))
  return base
}

/** Total monthly charge including paid extra shops beyond the plan allowance. */
export function monthlyTotal(
  agreedMonthlyPrice: number,
  extraShops: number,
  extraShopPrice: number | null
): number {
  return agreedMonthlyPrice + extraShops * (extraShopPrice ?? 0)
}

export function formatPKR(amount: number): string {
  return `Rs ${Math.round(amount).toLocaleString('en-PK')}`
}
