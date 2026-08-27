import { describe, it, expect } from 'vitest'
import { readTokenVersion, isSessionCurrent, REVOKE_SESSIONS, LEGACY_TOKEN_VERSION } from './token-version'

/**
 * These two functions decide whether a cookie is still allowed to act as somebody. Wrong
 * in one direction, a password reset quietly revokes nothing; wrong in the other, a shop
 * full of cashiers is signed out mid-shift. Both directions are covered below.
 */

describe('reading the version claim off a cookie', () => {
  it('reads a stamped version', () => {
    expect(readTokenVersion(3)).toBe(3)
  })

  it('reads a fresh account at zero', () => {
    expect(readTokenVersion(0)).toBe(0)
  })

  it('treats a cookie issued before this feature existed as version zero', () => {
    // Every existing user row is 0, so old cookies keep working the day this ships.
    // Without this, deploying would log out every open till at once.
    expect(readTokenVersion(undefined)).toBe(LEGACY_TOKEN_VERSION)
    expect(readTokenVersion(null)).toBe(LEGACY_TOKEN_VERSION)
  })

  it.each([['a string', '3'], ['a float', 1.5], ['a boolean', true], ['an object', {}], ['NaN', NaN]])(
    'refuses %s, which cannot have come from us',
    (_label, claim) => {
      // NaN never equals anything, so a mangled claim fails the comparison: fail closed.
      expect(Number.isNaN(readTokenVersion(claim as unknown))).toBe(true)
    }
  )
})

describe('whether a session is still current', () => {
  it('accepts a cookie stamped with the version the account still holds', () => {
    expect(isSessionCurrent(4, 4)).toBe(true)
  })

  it('rejects a cookie from before a password reset', () => {
    // The whole point: the attacker's stolen cookie says 4, the account has moved to 5.
    expect(isSessionCurrent(4, 5)).toBe(false)
  })

  it('rejects a version higher than the account has ever reached', () => {
    expect(isSessionCurrent(9, 5)).toBe(false)
  })

  it('rejects an unreadable claim', () => {
    expect(isSessionCurrent(NaN, 0)).toBe(false)
  })

  it('rejects when the user row came back without the column', () => {
    // A select that forgets tokenVersion must fail shut, not wave everyone through.
    expect(isSessionCurrent(0, undefined as unknown as number)).toBe(false)
  })
})

describe('the revocation fragment', () => {
  it('increments rather than assigns, so two racing resets both count', () => {
    expect(REVOKE_SESSIONS).toEqual({ tokenVersion: { increment: 1 } })
  })

  it('merges into a password update, so revoking costs no extra write', () => {
    expect({ password: 'hash', ...REVOKE_SESSIONS }).toEqual({
      password: 'hash',
      tokenVersion: { increment: 1 },
    })
  })
})

describe('the lifecycle a reset actually goes through', () => {
  it('kills the old cookie and accepts the one issued after', () => {
    const before = 2
    const afterReset = before + 1 // what REVOKE_SESSIONS does to the row
    expect(isSessionCurrent(before, afterReset)).toBe(false)
    expect(isSessionCurrent(afterReset, afterReset)).toBe(true)
  })

  it('leaves a pre-feature cookie working until that account is first reset', () => {
    const legacyCookie = readTokenVersion(undefined)
    expect(isSessionCurrent(legacyCookie, 0)).toBe(true)
    expect(isSessionCurrent(legacyCookie, 1)).toBe(false)
  })

  it('does not touch other accounts', () => {
    // Resetting one user bumps one row; everyone else's cookies are untouched.
    expect(isSessionCurrent(7, 7)).toBe(true)
  })
})
