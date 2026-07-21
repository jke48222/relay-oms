import type { OrderStatus } from '../types'

export function StatusChip({ status }: { status: OrderStatus }) {
  return <span className={`chip st-${status}`}>{status}</span>
}

/** Chip class for an event type: "order.allocation_failed" → exception red. */
export function eventChipClass(type: string): string {
  const suffix = type.replace(/^order\./, '')
  if (suffix === 'allocation_failed') return 'st-exception'
  if (suffix === 'received') return 'st-received'
  return `st-${suffix}`
}
