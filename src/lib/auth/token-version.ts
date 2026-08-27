/**
 * Session revocation, without a session table.
 *
 * Every session cookie is stamped with the `User.tokenVersion` it was issued under.
 * Bumping that column (a password reset or change) makes every cookie already in the
 * wild stop matching, so a compromised session dies on its next request.
 *
 * The design constraint is speed: this must not cost the POS a round trip. It doesn't,
 * because `getCurrentUser()` already reads the user row on every authenticated request.
 * The version is one more integer column on a query that runs anyway, and one integer
 * comparison. There is no session store to look up and no extra query.
 *
 * Kept pure and separate from `lib/auth.ts` so the coercion rules below are unit-testable
 * without a database. They are security-critical: get them wrong in one direction and
 * every cashier is signed out, in the other and revocation silently does nothing.
 */

/** What a session with no version claim is treated as. Matches the column default. */
export const LEGACY_TOKEN_VERSION = 0

/**
 * Reads the `v` claim off a verified JWT payload.
 *
 * Sessions issued before this feature existed carry no claim at all. Those are read as
 * version 0, which is what every existing user row holds, so deploying this does not sign
 * a shop full of cashiers out in the middle of a shift. They stay valid exactly until the
 * first password change moves that user off 0.
 *
 * Anything present but not a clean integer is a tampered or corrupt token: it returns NaN,
 * which never compares equal to a stored version, so the session is rejected. Fail closed.
 */
export function readTokenVersion(claim: unknown): number {
  if (claim === undefined || claim === null) return LEGACY_TOKEN_VERSION
  if (typeof claim !== 'number' || !Number.isInteger(claim)) return NaN
  return claim
}

/**
 * True when a session is still the one the user's account expects.
 *
 * Deliberately strict equality on two integers: a stale cookie from before a reset holds a
 * lower version, and a forged higher one still fails. NaN on either side is false, so an
 * unreadable claim or a user row read without the column can never pass.
 */
export function isSessionCurrent(sessionVersion: number, userVersion: number): boolean {
  return sessionVersion === userVersion
}

/**
 * Spread into any `user.update` to invalidate every session that user currently holds.
 *
 * It is a data fragment rather than its own function call on purpose: revocation should
 * ride on the write that already happens (the password update), so containing a compromise
 * costs zero extra queries. `increment` keeps it correct if two resets race.
 */
export const REVOKE_SESSIONS = { tokenVersion: { increment: 1 } } as const
