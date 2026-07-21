export function money(cents: number): string {
  return (cents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  })
}

export function compactMoney(cents: number): string {
  const dollars = cents / 100
  if (dollars >= 10_000) {
    return `$${(dollars / 1000).toLocaleString('en-US', { maximumFractionDigits: 1 })}k`
  }
  return money(cents)
}

export function clock(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour12: false })
}

export function duration(seconds: number | null): string {
  if (seconds == null) return '—'
  if (seconds < 90) return `${Math.round(seconds)}s`
  if (seconds < 5400) return `${(seconds / 60).toFixed(1)}m`
  return `${(seconds / 3600).toFixed(1)}h`
}

/** "order.allocation_failed" → "allocation failed" */
export function eventLabel(type: string): string {
  return type.replace(/^order\./, '').replaceAll('_', ' ')
}

/** Chip class for an event type: "order.allocation_failed" → exception red. */
export function eventChipClass(type: string): string {
  const suffix = type.replace(/^order\./, '')
  if (suffix === 'allocation_failed') return 'st-exception'
  return `st-${suffix}`
}

interface Sequenced {
  sequence: number
}

/**
 * Merge the live socket feed with the fetched backlog: dedupe by sequence
 * (live wins), newest first, capped. Pure so it's unit-testable.
 */
export function mergeFeed<T extends Sequenced>(live: T[], fetched: T[], cap = 60): T[] {
  const seen = new Set<number>()
  const merged: T[] = []
  for (const item of [...live, ...fetched]) {
    if (!seen.has(item.sequence)) {
      seen.add(item.sequence)
      merged.push(item)
    }
  }
  return merged.sort((a, b) => b.sequence - a.sequence).slice(0, cap)
}
