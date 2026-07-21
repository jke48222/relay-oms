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
