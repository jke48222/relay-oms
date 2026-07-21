import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { api } from '../api/client'
import { StatusChip } from '../components/StatusChip'
import { clock, money } from '../format'
import { ORDER_STATUSES } from '../types'

const CHANNELS = ['shopify', 'amazon', 'tiktok_shop', 'b2b', 'dtc']
const PAGE_SIZE = 15

export function Orders() {
  const navigate = useNavigate()
  const [status, setStatus] = useState('')
  const [channel, setChannel] = useState('')
  const [page, setPage] = useState(1)

  const { data, isPending } = useQuery({
    queryKey: ['orders', { status, channel, page }],
    queryFn: () => api.orders({ status, channel, page, page_size: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  })

  const total = data?.meta.total ?? 0
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const filter =
    (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLSelectElement>) => {
      setter(e.target.value)
      setPage(1)
    }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Every channel, one queue</div>
          <h1>Orders</h1>
        </div>
        <div className="controls">
          <select value={status} onChange={filter(setStatus)} aria-label="Filter by status">
            <option value="">All statuses</option>
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select value={channel} onChange={filter(setChannel)} aria-label="Filter by channel">
            <option value="">All channels</option>
            {CHANNELS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      <section className="card">
        <table>
          <thead>
            <tr>
              <th>Order</th>
              <th>Status</th>
              <th>Channel</th>
              <th>Customer</th>
              <th>Destination</th>
              <th>Facility</th>
              <th style={{ textAlign: 'right' }}>Total</th>
              <th style={{ textAlign: 'right' }}>Placed</th>
            </tr>
          </thead>
          <tbody>
            {data?.data.map((order) => (
              <tr
                key={order.id}
                className="rowlink"
                onClick={() => navigate(`/orders/${order.id}`)}
              >
                <td className="mono">{order.number}</td>
                <td>
                  <StatusChip status={order.status} />
                </td>
                <td className="mono muted">{order.channel}</td>
                <td>{order.customer_name}</td>
                <td className="muted">
                  {order.destination.city}, {order.destination.region}
                </td>
                <td className="mono">{order.facility?.code ?? '—'}</td>
                <td className="num" style={{ textAlign: 'right' }}>
                  {money(order.total_cents)}
                </td>
                <td className="mono muted" style={{ textAlign: 'right' }}>
                  {clock(order.placed_at)}
                </td>
              </tr>
            ))}
            {!isPending && data?.data.length === 0 && (
              <tr>
                <td colSpan={8} className="muted">
                  No orders match. Clear filters or simulate a few from the dashboard.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="controls" style={{ marginTop: 14, justifyContent: 'space-between' }}>
          <span className="mono muted">
            {total} orders · page {data?.meta.page ?? page}/{pages}
          </span>
          <span className="controls">
            <button
              className="btn ghost"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              ← Prev
            </button>
            <button
              className="btn ghost"
              disabled={page >= pages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next →
            </button>
          </span>
        </div>
      </section>
    </>
  )
}
