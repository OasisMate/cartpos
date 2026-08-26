/**
 * Cost of goods sold, per line, with no database in it.
 *
 * Two things here are easy to get wrong and both change the profit a shopkeeper is shown.
 *
 * 1. `costPrice` is stored per BASE unit (a purchase writes its `unitCost` straight onto the
 *    product, and the stock ledger moves base units). An invoice line, however, records the
 *    quantity in whatever the item was SOLD as: 2 cartons is `quantity = 2` with
 *    `unitsPerItem = 12`. Costing that as `costPrice x 2` instead of `costPrice x 24` understates
 *    the cost twelvefold and reports a profit the shop never made.
 *
 * 2. A product with no cost price is deliberately costed at its full sale value, so the line
 *    contributes zero profit rather than 100% profit. That is the safe direction, but it is
 *    silent: a shop that has not filled in cost prices sees a profit figure well below reality
 *    and has no idea why. `summariseCostCoverage` exists so the reports can say so out loud.
 */

export interface CogsLine {
  /** Quantity in the unit the item was sold as (packs, not base units). */
  quantity: number
  /** What the customer was charged for the line. */
  lineTotal: number
  /** Base units per sold item. 1 for a loose sale, cartonSize for a carton. */
  unitsPerItem?: number | null
  /** Cost per BASE unit, or null/0 when the shop has not recorded one. */
  costPrice?: number | null
}

/** Base units a line actually moved: pack count times pack size. */
export function baseUnitsOf(line: CogsLine): number {
  const per = Number(line.unitsPerItem)
  const factor = Number.isFinite(per) && per > 0 ? per : 1
  return Number(line.quantity) * factor
}

/** True when this line's cost is unknown and is therefore booked at zero profit. */
export function isCostUnknown(line: CogsLine): boolean {
  const cost = Number(line.costPrice)
  return !Number.isFinite(cost) || cost <= 0
}

/**
 * Cost of one sold line.
 *
 * Known cost: cost per base unit x base units moved.
 * Unknown cost: the line's own sale value, so it yields exactly zero profit. We do not guess a
 * margin, and we must not treat it as free stock either, which would report the whole sale as
 * profit.
 */
export function lineCogs(line: CogsLine): number {
  if (isCostUnknown(line)) return Number(line.lineTotal) || 0
  return Number(line.costPrice) * baseUnitsOf(line)
}

/** Total cost for a set of sold lines, rounded to paisa. */
export function sumCogs(lines: CogsLine[]): number {
  const total = lines.reduce((sum, line) => sum + lineCogs(line), 0)
  return Math.round(total * 100) / 100
}

export interface CostCoverage {
  /** Lines whose product has no cost price. */
  linesMissingCost: number
  /** Total sale value of those lines: revenue currently reported at zero profit. */
  revenueMissingCost: number
  /** Share of revenue in the period with no cost behind it, 0 to 1. */
  shareMissingCost: number
}

/**
 * How much of a period's revenue is being reported at zero profit purely because nobody entered
 * a cost price. Surfacing this is the difference between "your profit is 7%" and "your profit is
 * 7% on the 86% of sales we can cost".
 */
export function summariseCostCoverage(lines: CogsLine[]): CostCoverage {
  let linesMissingCost = 0
  let revenueMissingCost = 0
  let revenue = 0

  for (const line of lines) {
    const value = Number(line.lineTotal) || 0
    revenue += value
    if (isCostUnknown(line)) {
      linesMissingCost++
      revenueMissingCost += value
    }
  }

  return {
    linesMissingCost,
    revenueMissingCost: Math.round(revenueMissingCost * 100) / 100,
    shareMissingCost: revenue > 0 ? revenueMissingCost / revenue : 0,
  }
}
