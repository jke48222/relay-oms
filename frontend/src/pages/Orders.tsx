import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { api } from '../api/client'
import { StatusChip } from '../components/StatusChip'
import { QueryError } from '../components/QueryError'
import { IconPlus } from '../components/Icons'
import { usePageTitle } from '../hooks/usePageTitle'
import { clock, money } from '../format'
import { ORDER_STATUSES } from '../types'

const CHANNELS = ['shopify', 'amazon', 'tiktok_shop', 'b2b', 'dtc']
const PAGE_SIZE = 15

export function Orders() {
  usePageTitle('Orders')
  const navigate = useNavigate()
  // Filters live in the URL so the topbar search and bell badge can deep-link
  // here (?number=…, ?status=exception).
  const [params, setParams] = useSearchParams()
  const status = params.get('status') ?? ''
  const channel = params.get('channel') ?? ''
  const number = params.get('number') ?? ''
  const page = Math.max(1, Number(params.get('page')) || 1)

  const query = useQuery({
    queryKey: ['orders', { status, channel, number, page }],
    queryFn: ({ signal }) =>
      api.orders({ status, channel, number, page, page_size: PAGE_SIZE }, signal),
    placeholderData: keepPreviousData,
  })

  const total = query.data?.meta.total ?? 0
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  function updateParam(key: string, value: string) {
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      if (value) next.set(key, value)
      else next.delete(key)
      next.delete('page')
      return next
    })
  }

  function goToPage(next: number) {
    setParams((prev) => {
      const p = new URLSearchParams(prev)
      p.set('page', String(next))
      return p
    })
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Orders</h1>
          <p className="page-sub">Every channel, one queue.</p>
        </div>
        <div className="controls">
          <select
            value={status}
            onChange={(e) => updateParam('status', e.target.value)}
            aria-label="Filter by status"
          >
            <option value="">All statuses</option>
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            value={channel}
            onChange={(e) => updateParam('channel', e.target.value)}
            aria-label="Filter by channel"
          >
            <option value="">All channels</option>
            {CHANNELS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <Link to="/orders/new" className="btn">
            <IconPlus /> New order
          </Link>
        </div>
      </div>

      {number && (
        <div className="banner info">
          Showing matches for “{number}”
          <button className="btn ghost small" onClick={() => updateParam('number', '')}>
            Clear
          </button>
        </div>
      )}

      <section className="card">
        {query.isError ? (
          <QueryError what="orders" onRetry={() => query.refetch()} />
        ) : (
          <>
            <div className="table-scroll">
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
                  {query.data?.data.map((order) => (
                    <tr
                      key={order.id}
                      className="rowlink"
                      onClick={() => navigate(`/orders/${order.id}`)}
                    >
                      <td>
                        <Link
                          className="cell-link"
                          to={`/orders/${order.id}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {order.number}
                        </Link>
                      </td>
                      <td>
                        <StatusChip status={order.status} />
                      </td>
                      <td className="muted">{order.channel}</td>
                      <td>{order.customer_name}</td>
                      <td className="muted">
                        {order.destination.city}, {order.destination.region}
                      </td>
                      <td style={{ fontWeight: 700 }}>{order.facility?.code ?? '—'}</td>
                      <td className="num" style={{ textAlign: 'right' }}>
                        {money(order.total_cents)}
                      </td>
                      <td className="muted" style={{ textAlign: 'right' }}>
                        <time dateTime={order.placed_at}>{clock(order.placed_at)}</time>
                      </td>
                    </tr>
                  ))}
                  {!query.isPending && query.data?.data.length === 0 && (
                    <tr>
                      <td colSpan={8} className="empty">
                        No orders match. Clear filters, or create one.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="controls" style={{ marginTop: 16, justifyContent: 'space-between' }}>
              <span className="muted num">
                {total} orders · page {query.data?.meta.page ?? page}/{pages}
              </span>
              <span className="controls">
                <button
                  className="btn ghost small"
                  disabled={page <= 1}
                  onClick={() => goToPage(page - 1)}
                >
                  ← Prev
                </button>
                <button
                  className="btn ghost small"
                  disabled={page >= pages}
                  onClick={() => goToPage(page + 1)}
                >
                  Next →
                </button>
              </span>
            </div>
          </>
        )}
      </section>
    </>
  )
}
