/**
 * How seats are counted, and what a paused seat means.
 *
 * A "seat" is a PERSON, not a membership row: someone attached to three shops is one
 * seat, because that is what the plan sells. The rules below are pure so they can be
 * tested without a database, and because getting them wrong costs real money in both
 * directions (undercounting gives away seats, overcounting blocks a paying customer
 * from hiring).
 *
 * A downgrade pauses the seats that no longer fit (`UserShop.isActive = false`). Paused
 * people can still sign in and read everything, but cannot write (see
 * `requirePaidWrite`), and they STILL COUNT against the cap. That last part is the
 * point: pausing is not a way to shed seats, it is a prompt to upgrade. Before this,
 * paused rows were invisible to the cap, so an org could pause staff who kept working
 * and then hire replacements into the seats they had just vacated.
 */

export interface SeatRow {
  userId: string
  shopRole: string
  isActive: boolean
}

export interface SeatCount {
  /** Distinct people holding a membership in the org, paused or not. */
  total: number
  /** Distinct people whose every membership is paused. */
  paused: number
  /** Distinct people who are a cashier somewhere in the org. */
  cashiers: number
  /** Of those cashiers, how many are fully paused. */
  pausedCashiers: number
}

/**
 * Collapses membership rows to people.
 *
 * Someone is only "paused" when NONE of their memberships is active. One active shop is
 * enough to be a working seat, so a partially paused person is counted as active: they
 * can still sell somewhere, and charging them as a full seat is the honest reading.
 */
export function countSeats(rows: SeatRow[]): SeatCount {
  const people = new Map<string, { anyActive: boolean; isCashier: boolean }>()
  for (const row of rows) {
    const seen = people.get(row.userId)
    if (seen) {
      seen.anyActive = seen.anyActive || row.isActive
      seen.isCashier = seen.isCashier || row.shopRole === 'CASHIER'
    } else {
      people.set(row.userId, { anyActive: row.isActive, isCashier: row.shopRole === 'CASHIER' })
    }
  }

  let paused = 0
  let cashiers = 0
  let pausedCashiers = 0
  for (const p of people.values()) {
    if (!p.anyActive) paused++
    if (p.isCashier) {
      cashiers++
      if (!p.anyActive) pausedCashiers++
    }
  }

  return { total: people.size, paused, cashiers, pausedCashiers }
}

/**
 * Whether a NEW membership row for this person should start paused.
 *
 * Closes the hole that made the pause meaningless: assigning a paused person to another
 * store created a row with the column default (`isActive: true`), which quietly restored
 * a seat the plan no longer covered. Nobody had to pay and nothing recorded it.
 *
 * `existing` is that person's other memberships in the SAME org. All paused means the
 * plan does not cover them, so the new row is paused too. Anything active means they are
 * already a working seat and the new row joins them.
 */
export function newSeatStartsPaused(existing: Array<{ isActive: boolean }>): boolean {
  return existing.length > 0 && existing.every((row) => !row.isActive)
}
