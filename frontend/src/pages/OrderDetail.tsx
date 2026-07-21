import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from '../api/client'
import { StatusChip } from '../components/StatusChip'
import { clock, eventLabel, money } from '../format'
import type { OrderStatus } from '../types'

const CANCELLABLE: OrderStatus[] = ['received', 'allocated', 'picking', 'exception']

export function OrderDetail() {
  const { id = '' } = useParams()
  const queryClient = useQueryClient()

  const { data: order, error } = useQuery({
    queryKey: ['order', id],
    queryFn: () => api.order(id),
    retry: (count, err) =>
      err instanceof ApiError && err.status === 404 ? false : count < 2,
  })

  const cancel = useMutation({
    mutationFn: () => api.cancelOrder(id),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['order', id] })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
    },
  })

  if (error instanceof ApiError && error.status === 404) {
    return (
      <p className="muted">
        Order not found. <Link to="/orders">Back to orders</Link>
      </p>
    )
  }

  if (!order) return <p className="muted">Loading…</p>

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">
            <Link to="/orders">Orders</Link> / {order.number}
          </div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {order.number} <StatusChip status={order.status} />
          </h1>
        </div>
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

      <div className="grid-main">
        <div style={{ display: 'grid', gap: 16 }}>
          <section className="card">
            <h3>Details</h3>
            <table>
              <tbody>
                <tr>
                  <th style={{ width: 140 }}>Customer</th>
                  <td>{order.customer_name}</td>
                </tr>
                <tr>
                  <th>Destination</th>
                  <td>
                    {order.destination.city}, {order.destination.region}
                  </td>
                </tr>
                <tr>
                  <th>Channel</th>
                  <td className="mono">{order.channel}</td>
                </tr>
                <tr>
                  <th>Fulfilled from</th>
                  <td className="mono">
                    {order.facility
                      ? `${order.facility.code} — ${order.facility.city}, ${order.facility.region}`
                      : 'not yet allocated'}
                  </td>
                </tr>
                <tr>
                  <th>Placed</th>
                  <td className="mono">{new Date(order.placed_at).toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section className="card">
            <h3>Line items</h3>
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
                    <td className="mono">{item.sku}</td>
                    <td>{item.name}</td>
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
                <tr>
                  <td colSpan={4} style={{ textAlign: 'right', fontWeight: 700 }}>
                    Order total
                  </td>
                  <td className="num" style={{ textAlign: 'right', fontWeight: 700 }}>
                    {money(order.total_cents)}
                  </td>
                </tr>
              </tbody>
            </table>
          </section>

          {order.shipment && (
            <section className="card">
              <h3>Shipment</h3>
              <p className="mono">
                {order.shipment.carrier} · {order.shipment.tracking_number}
              </p>
              <p className="muted" style={{ margin: 0 }}>
                Shipped {new Date(order.shipment.shipped_at).toLocaleString()}
                {order.shipment.delivered_at &&
                  ` · Delivered ${new Date(order.shipment.delivered_at).toLocaleString()}`}
              </p>
            </section>
          )}
        </div>

        <section className="card">
          <h3>Event timeline</h3>
          <p className="muted" style={{ marginTop: 0, fontSize: 12.5 }}>
            Every state change below is a row in the append-only event log — the
            order's history is the source of truth, not a mutable status column.
          </p>
          <ul className="timeline">
            {order.events.map((event) => (
              <li
                key={event.sequence}
                className={event.type === 'order.allocation_failed' ? 'fail' : ''}
              >
                <div className="t-type">
                  #{event.sequence} · {eventLabel(event.type)}
                </div>
                <div className="t-meta">
                  {clock(event.inserted_at)}
                  {typeof event.payload.carrier === 'string' &&
                    ` · ${event.payload.carrier} ${event.payload.tracking_number}`}
                  {typeof event.payload.reason === 'string' &&
                    ` · ${event.payload.reason}`}
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  )
}
