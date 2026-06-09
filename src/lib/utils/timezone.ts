/**
 * Timezone-aware "day" helpers. Pure (Intl only) so they work on both the
 * server and the client. Used to compute a shop's local "today" so dashboards
 * and reports agree on day boundaries regardless of where the server runs.
 */

export const DEFAULT_TIMEZONE = 'Asia/Karachi'

// A short list of timezones relevant to the product (Pakistan-first), used by
// the Settings dropdown. IANA names.
export const COMMON_TIMEZONES: Array<{ value: string; label: string }> = [
  { value: 'Asia/Karachi', label: 'Pakistan (Asia/Karachi, GMT+5)' },
  { value: 'Asia/Dubai', label: 'UAE (Asia/Dubai, GMT+4)' },
  { value: 'Asia/Riyadh', label: 'Saudi Arabia (Asia/Riyadh, GMT+3)' },
  { value: 'Asia/Kolkata', label: 'India (Asia/Kolkata, GMT+5:30)' },
  { value: 'Asia/Dhaka', label: 'Bangladesh (Asia/Dhaka, GMT+6)' },
  { value: 'Europe/London', label: 'UK (Europe/London)' },
  { value: 'America/New_York', label: 'US Eastern (America/New_York)' },
  { value: 'UTC', label: 'UTC' },
]

/**
 * Offset in minutes such that: localWallClock = utc + offset.
 * Computed via Intl so it is correct for any IANA zone (incl. DST).
 */
function tzOffsetMinutes(timeZone: string, date: Date): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const map: Record<string, string> = {}
  for (const p of dtf.formatToParts(date)) {
    if (p.type !== 'literal') map[p.type] = p.value
  }
  const asUTC = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second)
  )
  return Math.round((asUTC - date.getTime()) / 60000)
}

/** 'YYYY-MM-DD' for the shop's local calendar day. */
export function shopTodayYMD(timeZone: string = DEFAULT_TIMEZONE, now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

/** UTC instant for 00:00:00.000 of the given shop-local day (YYYY-MM-DD). */
export function startOfShopDayUTC(timeZone: string, ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number)
  // Treat the wall-clock midnight as if it were UTC, then subtract the zone offset.
  const localMidnightAsUTC = Date.UTC(y, m - 1, d, 0, 0, 0, 0)
  const offsetMin = tzOffsetMinutes(timeZone, new Date(localMidnightAsUTC))
  return new Date(localMidnightAsUTC - offsetMin * 60000)
}

/** UTC instant for the start of the shop's local "today" (for dashboards). */
export function shopDayStartUTC(timeZone: string = DEFAULT_TIMEZONE, now: Date = new Date()): Date {
  return startOfShopDayUTC(timeZone, shopTodayYMD(timeZone, now))
}

/**
 * UTC bounds for an inclusive shop-local day range [fromYMD .. toYMD].
 * `end` is exclusive (start of the day after toYMD) for clean `< end` queries.
 */
export function shopDayBoundsUTC(
  timeZone: string,
  fromYMD: string,
  toYMD: string
): { start: Date; endExclusive: Date } {
  const start = startOfShopDayUTC(timeZone, fromYMD)
  const toStart = startOfShopDayUTC(timeZone, toYMD)
  const endExclusive = new Date(toStart.getTime() + 24 * 60 * 60 * 1000)
  return { start, endExclusive }
}
