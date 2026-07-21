import { describe, expect, it } from 'vitest'
import { compactMoney, duration, eventLabel, money } from './format'

describe('money', () => {
  it('formats cents as USD', () => {
    expect(money(123456)).toBe('$1,234.56')
    expect(money(0)).toBe('$0.00')
  })

  it('compacts large amounts', () => {
    expect(compactMoney(2_450_000)).toBe('$24.5k')
    expect(compactMoney(9_900)).toBe('$99.00')
  })
})

describe('duration', () => {
  it('scales units to the magnitude', () => {
    expect(duration(null)).toBe('—')
    expect(duration(45)).toBe('45s')
    expect(duration(150)).toBe('2.5m')
    expect(duration(7200)).toBe('2.0h')
  })
})

describe('eventLabel', () => {
  it('strips the order. prefix and underscores', () => {
    expect(eventLabel('order.allocation_failed')).toBe('allocation failed')
    expect(eventLabel('order.received')).toBe('received')
  })
})
