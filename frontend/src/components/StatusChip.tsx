import type { OrderStatus } from '../types'

export function StatusChip({ status }: { status: OrderStatus }) {
  return <span className={`chip st-${status}`}>{status}</span>
}
