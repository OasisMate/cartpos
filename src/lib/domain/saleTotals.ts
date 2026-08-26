/**
 * The arithmetic guard on a sale's money, with no database in it.
 *
 * This is what stops a client from posting a sale whose totals do not add up, whether the
 * client is our own POS, a replayed offline queue, or something hand-rolled. It was inline
 * in `validateSaleInput`, tangled with product and stock lookups, which made the one piece
 * of logic that decides whether money is correct the one piece that could not be tested.
 *
 * Everything here is pure: same inputs, same verdict.
 */

/** Money is compared to the paisa. Anything inside this is float noise, not a discrepancy. */
export const MONEY_EPSILON = 0.01

export interface SaleTotalsLine {
  quantity: number
  unitPrice: number
  lineTotal: number
}

export interface SaleTotalsInput {
  items: SaleTotalsLine[]
  subtotal: number
  discount: number
  serviceCharge?: number
  deliveryCharge?: number
  total: number
  paymentStatus: 'PAID' | 'UDHAAR'
  paymentMethod?: 'CASH' | 'CARD' | 'OTHER'
}

export interface CardFeePolicy {
  /** The shop's configured card surcharge, as a percentage of the pre-card total. */
  cardFeePercent?: number | null
  /** Whether a cashier may dial the percentage up at the counter. */
  allowCardFeeOverride?: boolean | null
}

export interface SaleTotalsResult {
  serviceCharge: number
  deliveryCharge: number
  /** Total before any card fee: subtotal - discount + service + delivery. */
  preCardTotal: number
  /** What the customer was actually charged on top for paying by card. Zero for non-card. */
  cardFee: number
}

/** Each line must be a real, positive quantity at a sane price, and its own maths must hold. */
export function validateSaleLines(items: SaleTotalsLine[]): void {
  for (const item of items) {
    if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
      throw new Error('All items must have a quantity greater than 0')
    }
    if (
      !Number.isFinite(item.unitPrice) ||
      item.unitPrice < 0 ||
      !Number.isFinite(item.lineTotal) ||
      item.lineTotal < 0
    ) {
      throw new Error('Invalid item price or line total')
    }
    if (Math.abs(item.lineTotal - item.quantity * item.unitPrice) > MONEY_EPSILON) {
      throw new Error('Line total does not match quantity × unit price')
    }
  }
}

/** The header figures must at least be real numbers, and a discount cannot be negative. */
export function validateSaleHeader(input: SaleTotalsInput): void {
  if (
    !Number.isFinite(input.subtotal) ||
    !Number.isFinite(input.discount) ||
    !Number.isFinite(input.total) ||
    input.discount < 0
  ) {
    throw new Error('Invalid sale totals')
  }
}

/**
 * Check the client's `total` against what the lines and charges say it should be.
 *
 * Order of charges: subtotal - discount, then service, then delivery, then any card fee.
 *
 * The card fee is deliberately checked as a RANGE rather than forced to the shop's configured
 * percentage. Enforcing an exact fee here would permanently strand a sale that was already
 * paid for: a device that rang it up offline before settings loaded would send a zero or stale
 * fee, the server would refuse it forever, and that refusal stalls the whole sync queue and
 * loses a real sale from the books. Fee policy belongs at ring-up. What must never be accepted
 * is a fee below zero or above what the shop could legitimately have charged.
 */
export function validateSaleTotals(
  input: SaleTotalsInput,
  policy: CardFeePolicy = {}
): SaleTotalsResult {
  validateSaleLines(input.items)
  validateSaleHeader(input)

  const calculatedSubtotal = input.items.reduce((sum, item) => sum + item.lineTotal, 0)

  // A discount may take a sale to zero, never below it. Without this a client could post
  // subtotal 600 / discount 1000 and every other check would pass, writing an invoice with a
  // total of -400: for a paid sale that is money leaving the drawer, and for an udhaar sale it
  // credits the customer's khata for goods they were given. The POS already caps the discount
  // at the subtotal, so this only closes the gap for anything not going through that screen
  // (a replayed offline queue, a direct API call).
  if (input.discount > calculatedSubtotal + MONEY_EPSILON) {
    throw new Error('Discount cannot exceed the sale subtotal')
  }

  const baseTotal = calculatedSubtotal - input.discount

  const serviceCharge = Number(input.serviceCharge ?? 0)
  const deliveryCharge = Number(input.deliveryCharge ?? 0)
  if (
    !Number.isFinite(serviceCharge) ||
    serviceCharge < 0 ||
    !Number.isFinite(deliveryCharge) ||
    deliveryCharge < 0
  ) {
    throw new Error('Invalid service or delivery charge')
  }

  const preCardTotal = baseTotal + serviceCharge + deliveryCharge

  let expectedTotal = preCardTotal
  let cardFee = 0

  if (input.paymentStatus === 'PAID' && input.paymentMethod === 'CARD') {
    const shopPct = Number(policy.cardFeePercent ?? 0)
    const allowOverride = policy.allowCardFeeOverride ?? false
    const configuredFee = Math.round(preCardTotal * shopPct) / 100
    // Ceiling on what the client could legitimately have charged. With override the cashier can
    // raise the percentage (the POS caps it at 100%), so allow up to the full pre-card total;
    // otherwise the shop's configured percentage is the limit.
    const maxFee = allowOverride ? preCardTotal : configuredFee
    const impliedFee = input.total - preCardTotal

    if (impliedFee < -MONEY_EPSILON || impliedFee > maxFee + MONEY_EPSILON) {
      throw new Error('Total calculation mismatch')
    }
    expectedTotal = input.total
    cardFee = impliedFee
  }

  if (Math.abs(expectedTotal - input.total) > MONEY_EPSILON) {
    throw new Error('Total calculation mismatch')
  }

  return { serviceCharge, deliveryCharge, preCardTotal, cardFee }
}
