import { describe, expect, it } from 'vitest'
import { compactMoney, duration, eventLabel, mergeFeed, money } from './format'

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

describe('mergeFeed', () => {
  const ev = (sequence: number, source = 'live') => ({ sequence, source })

  it('dedupes by sequence with live winning', () => {
    const merged = mergeFeed([ev(3, 'live')], [ev(3, 'fetched'), ev(2, 'fetched')])
    expect(merged).toHaveLength(2)
    expect(merged[0]).toEqual(ev(3, 'live'))
  })

  it('sorts newest-first regardless of input order', () => {
    const merged = mergeFeed([ev(1)], [ev(9), ev(4)])
    expect(merged.map((e) => e.sequence)).toEqual([9, 4, 1])
  })

  it('caps the merged feed', () => {
    const live = Array.from({ length: 40 }, (_, i) => ev(100 + i))
    const fetched = Array.from({ length: 40 }, (_, i) => ev(i))
    const merged = mergeFeed(live, fetched, 60)
    expect(merged).toHaveLength(60)
    expect(merged[0].sequence).toBe(139)
  })
})
