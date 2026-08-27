import { describe, it, expect } from 'vitest'
import { countSeats, newSeatStartsPaused } from './seats'

/**
 * A seat is a person, and a paused person still occupies one. Both halves of that rule
 * cost money when they are wrong: undercount and seats are given away, overcount and a
 * paying shop is stopped from hiring.
 */

const row = (userId: string, shopRole: string, isActive = true) => ({ userId, shopRole, isActive })

describe('counting people, not membership rows', () => {
  it('counts one person once however many shops they work in', () => {
    const c = countSeats([
      row('u1', 'CASHIER'),
      row('u1', 'CASHIER'),
      row('u1', 'STORE_MANAGER'),
    ])
    expect(c.total).toBe(1)
  })

  it('counts distinct people', () => {
    expect(countSeats([row('u1', 'CASHIER'), row('u2', 'CASHIER')]).total).toBe(2)
  })

  it('counts nothing for an org with no memberships', () => {
    expect(countSeats([])).toEqual({ total: 0, paused: 0, cashiers: 0, pausedCashiers: 0 })
  })
})

describe('paused people still occupy their seat', () => {
  it('counts a fully paused person in the total', () => {
    // The leak this closes: paused staff kept working while their seats read as free, so
    // the owner could hire replacements into seats that were never actually vacated.
    const c = countSeats([row('u1', 'CASHIER', true), row('u2', 'CASHIER', false)])
    expect(c.total).toBe(2)
    expect(c.paused).toBe(1)
  })

  it('treats someone with one active shop as active, not paused', () => {
    // They can still sell somewhere, so charging them as a working seat is the honest read.
    const c = countSeats([row('u1', 'CASHIER', false), row('u1', 'CASHIER', true)])
    expect(c.total).toBe(1)
    expect(c.paused).toBe(0)
  })

  it('counts someone paused everywhere as paused', () => {
    const c = countSeats([row('u1', 'CASHIER', false), row('u1', 'STORE_MANAGER', false)])
    expect(c.paused).toBe(1)
  })

  it('does not double-count a paused person across shops', () => {
    const c = countSeats([row('u1', 'CASHIER', false), row('u1', 'CASHIER', false)])
    expect(c.total).toBe(1)
    expect(c.paused).toBe(1)
  })
})

describe('the cashier sub-cap', () => {
  it('counts a person who is a cashier anywhere', () => {
    const c = countSeats([row('u1', 'STORE_MANAGER'), row('u1', 'CASHIER')])
    expect(c.cashiers).toBe(1)
  })

  it('does not count a manager as a cashier', () => {
    expect(countSeats([row('u1', 'STORE_MANAGER')]).cashiers).toBe(0)
  })

  it('counts paused cashiers separately, so the message can explain the block', () => {
    const c = countSeats([
      row('u1', 'CASHIER', true),
      row('u2', 'CASHIER', false),
      row('u3', 'STORE_MANAGER', false),
    ])
    expect(c.cashiers).toBe(2)
    expect(c.pausedCashiers).toBe(1)
    expect(c.paused).toBe(2)
  })
})

describe('whether a new membership starts paused', () => {
  it('starts active for somebody brand new to the org', () => {
    expect(newSeatStartsPaused([])).toBe(false)
  })

  it('starts paused when every existing seat of theirs is paused', () => {
    // Otherwise assigning a paused person to any store handed their access back for free.
    expect(newSeatStartsPaused([{ isActive: false }, { isActive: false }])).toBe(true)
  })

  it('starts active when they already work somewhere', () => {
    expect(newSeatStartsPaused([{ isActive: false }, { isActive: true }])).toBe(false)
  })

  it('starts active when their only seat is active', () => {
    expect(newSeatStartsPaused([{ isActive: true }])).toBe(false)
  })
})
