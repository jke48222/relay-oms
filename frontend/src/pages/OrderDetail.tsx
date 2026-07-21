import { Link, useLocation, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from '../api/client'
import { StatusChip } from '../components/StatusChip'
import { QueryError } from '../components/QueryError'
import { IconArrowLeft } from '../components/Icons'
import { usePageTitle } from '../hooks/usePageTitle'
import { clock, eventLabel, money } from '../format'
import type { OrderStatus } from '../types'

const CANCELLABLE: OrderStatus[] = ['received', 'allocated', 'picking', 'exception']

export function OrderDetail() {
  const { id = '' } = useParams()
  const location = useLocation()
  const queryClient = useQueryClient()
  const replayed = (location.state as { replayed?: boolean } | null)?.replayed

  const query = useQuery({
    queryKey: ['order', id],
    queryFn: ({ signal }) => api.order(id, signal),
    retry: (count, err) =>
      err instanceof ApiError && err.status === 404 ? false : count < 2,
  })
  const order = query.data

  usePageTitle(order ? `Order ${order.number}` : 'Order')

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['order', id] })
    queryClient.invalidateQueries({ queryKey: ['orders'] })
  }

  const cancel = useMutation({ mutationFn: () => api.cancelOrder(id), onSettled: invalidate })
  const retry = useMutation({ mutationFn: () => api.retryOrder(id), onSettled: invalidate })

  if (query.error instanceof ApiError && query.error.status === 404) {
    return (
      <>
        <div className="page-head">
          <h1>
            <Link to="/orders" className="back-btn" aria-label="Back to orders">
              <IconArrowLeft />
            </Link>
            Order not found
          </h1>
        </div>
        <p className="empty">
          That order doesn't exist. <Link to="/orders">Back to orders</Link>
        </p>
      </>
    )
  }

  if (query.isError) {
    return <QueryError what="this order" onRetry={() => query.refetch()} />
  }

  if (!order) return <p className="empty">Loading…</p>

  const units = order.line_items.reduce((sum, li) => sum + li.quantity, 0)

  return (
    <>
      <div className="page-head">
        <h1>
          <Link to="/orders" className="back-btn" aria-label="Back to orders">
            <IconArrowLeft />
          </Link>
          Order summary
        </h1>
        <div className="controls">
          {order.status === 'exception' && (
            <button className="btn" onClick={() => retry.mutate()} disabled={retry.isPending}>
              Retry allocation
            </button>
          )}
          {CANCELLABLE.includes(order.status) && (
            <button
              className="btn danger"
              onClick={() => cancel.mutate()}
              disabled={cancel.isPending}
            >
              Cancel order
            </button>
          )}
        </div>
      </div>

      {replayed && (
        <div className="banner good">
          Idempotent replay — this request had already been processed, so the original
          order was returned instead of a duplicate.
        </div>
      )}
      {order.status === 'exception' && (
        <div className="banner bad">
          Allocation failed — no facility could cover every line item. Receive stock on
          the Inventory page, then retry.
        </div>
      )}

      <div className="grid-main">
        <div className="stack">
          <section className="card">
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 12,
                flexWrap: 'wrap',
                marginBottom: 4,
              }}
            >
              <h3 style={{ margin: 0, fontSize: 20 }}>{order.number}</h3>
              <StatusChip status={order.status} />
            </div>
            <p className="card-sub" style={{ margin: '2px 0 16px' }}>
              {order.customer_name} · {order.destination.city}, {order.destination.region} ·
              placed <time dateTime={order.placed_at}>{clock(order.placed_at)}</time>
            </p>

            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Product</th>
                    <th style={{ textAlign: 'right' }}>Qty</th>
                    <th style={{ textAlign: 'right' }}>Unit</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {order.line_items.map((item) => (
                    <tr key={item.id}>
                      <td className="muted">{item.sku}</td>
                      <td style={{ fontWeight: 600 }}>{item.name}</td>
                      <td className="num" style={{ textAlign: 'right' }}>
                        {item.quantity}
                      </td>
                      <td className="num" style={{ textAlign: 'right' }}>
                        {money(item.unit_price_cents)}
                      </td>
                      <td className="num" style={{ textAlign: 'right' }}>
                        {money(item.quantity * item.unit_price_cents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

        </div>

        <div className="stack">
          <section className="card">
            <h3>Payment summary</h3>
            <div className="keyline">
              <div className="krow head">
                <b>{order.number}</b>
                <span className="kv">
                  {order.line_items.length}{' '}
                  {order.line_items.length === 1 ? 'item' : 'items'}
                </span>
              </div>
              {order.line_items.map((item) => (
                <div className="krow" key={item.id}>
                  <span>
                    {item.name} × {item.quantity}
                  </span>
                  <span className="kv">{money(item.quantity * item.unit_price_cents)}</span>
                </div>
              ))}
              <div className="krow">
                <span>Delivery charge</span>
                <span className="kv">{money(0)}</span>
              </div>
              <div className="krow total">
                <span>Net payable amount</span>
                <span className="kv">{money(order.total_cents)}</span>
              </div>
            </div>
          </section>

          <section className="card">
            <h3>Event timeline</h3>
            <p className="card-sub">
              Every state change is a row in the append-only event log — the history is
              the source of truth, not a mutable status column.
            </p>
            <ul className="timeline">
              {order.events.map((event) => (
                <li
                  key={event.sequence}
                  className={event.type === 'order.allocation_failed' ? 'fail' : ''}
                >
                  <div className="t-type">
                    #{event.sequence} · {eventLabel(event.type)}
                    {event.payload.retry === true ? ' (retry)' : ''}
                  </div>
                  <div className="t-meta">
                    <time dateTime={event.inserted_at}>{clock(event.inserted_at)}</time>
                    {typeof event.payload.carrier === 'string' &&
                      ` · ${event.payload.carrier} ${event.payload.tracking_number}`}
                    {typeof event.payload.reason === 'string' && ` · ${event.payload.reason}`}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      <div className="grid-3" style={{ marginTop: 18 }}>
        <section className="card">
          <h3>Customer info</h3>
              <div className="inset">
                <div className="irow">
                  <b>Name :</b>
                  <span>{order.customer_name}</span>
                </div>
                <div className="irow">
                  <b>Ship to :</b>
                  <span>
                    {order.destination.city}, {order.destination.region}
                  </span>
                </div>
                <div className="irow">
                  <b>Channel :</b>
                  <span>{order.channel}</span>
                </div>
              </div>
            </section>

            <section className="card">
              <h3>Fulfillment</h3>
              <div className="inset">
                <div className="irow">
                  <b>Facility :</b>
                  <span>{order.facility?.code ?? 'not yet allocated'}</span>
                </div>
                <div className="irow">
                  <b>Location :</b>
                  <span>
                    {order.facility
                      ? `${order.facility.city}, ${order.facility.region}`
                      : '—'}
                  </span>
                </div>
                <div className="irow">
                  <b>Units :</b>
                  <span>{units}</span>
                </div>
              </div>
            </section>

            <section className="card">
              <h3>Delivery info</h3>
              <div className="inset">
                <div className="irow">
                  <b>Carrier :</b>
                  <span>{order.shipment?.carrier ?? 'pending'}</span>
                </div>
                <div className="irow">
                  <b>Tracking :</b>
                  <span>{order.shipment?.tracking_number ?? '—'}</span>
                </div>
                <div className="irow">
                  <b>Shipped :</b>
                  <span>
                    {order.shipment ? (
                      <time dateTime={order.shipment.shipped_at}>
                        {clock(order.shipment.shipped_at)}
                      </time>
                    ) : (
                      '—'
                    )}
                  </span>
                </div>
                <div className="irow">
                  <b>Delivered :</b>
                  <span>
                    {order.shipment?.delivered_at ? (
                      <time dateTime={order.shipment.delivered_at}>
                        {clock(order.shipment.delivered_at)}
                      </time>
                    ) : (
                      '—'
                    )}
                  </span>
                </div>
              </div>
            </section>
      </div>
    </>
  )
}
