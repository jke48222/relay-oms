import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { useRealtime } from '../realtime/RealtimeProvider'
import { QueryError } from '../components/QueryError'
import { IconZap } from '../components/Icons'
import { usePageTitle } from '../hooks/usePageTitle'
import { clock, compactMoney, duration, eventChipClass, eventLabel, mergeFeed } from '../format'
import type { OrderStatus } from '../types'

const FUNNEL: OrderStatus[] = [
  'received',
  'allocated',
  'picking',
  'packed',
  'shipped',
  'delivered',
  'exception',
]

const SCARCE_SKU = 'SUNGLASS-OG-POLAR'

export function Overview() {
  usePageTitle('Overview')
  const { events: liveEvents, metrics: liveMetrics } = useRealtime()
  const queryClient = useQueryClient()
  const [burst, setBurst] = useState<string | null>(null)

  // Fall back to fetched data before the socket delivers its first push.
  const metricsQuery = useQuery({
    queryKey: ['metrics'],
    queryFn: ({ signal }) => api.metrics(signal),
  })
  const eventsQuery = useQuery({
    queryKey: ['events'],
    queryFn: ({ signal }) => api.events(30, signal),
  })
  const inventoryQuery = useQuery({
    queryKey: ['inventory'],
    queryFn: ({ signal }) => api.inventory(signal),
  })
  const productsQuery = useQuery({
    queryKey: ['products'],
    queryFn: ({ signal }) => api.products(signal),
  })

  const metrics = liveMetrics ?? metricsQuery.data
  const feed = useMemo(
    () => mergeFeed(liveEvents, eventsQuery.data ?? []),
    [liveEvents, eventsQuery.data],
  )

  // The "+N in flight" note fades on its own once the burst has moved on.
  useEffect(() => {
    if (!burst) return
    const timer = setTimeout(() => setBurst(null), 10_000)
    return () => clearTimeout(timer)
  }, [burst])

  const simulate = useMutation({
    mutationFn: api.simulate,
    onSuccess: (result) => setBurst(`+${result.count} orders in flight`),
  })

  const forceStockout = useMutation({
    mutationFn: async () => {
      const products = productsQuery.data ?? (await api.products())
      const scarce = products.find((p) => p.sku === SCARCE_SKU)
      if (!scarce) throw new Error('scarce SKU not seeded')
      return api.createOrder({
        channel: 'dtc',
        customer_name: 'Stress Test',
        destination_city: 'Fort Worth',
        destination_region: 'TX',
        line_items: [{ product_id: scarce.id, quantity: 99 }],
      })
    },
    onSuccess: () => {
      setBurst('stockout order placed — watch the exception lane')
      queryClient.invalidateQueries({ queryKey: ['orders'] })
    },
  })

  const maxCount = Math.max(1, ...FUNNEL.map((s) => metrics?.status_counts[s] ?? 0))

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Overview</h1>
          <p className="page-sub">Checkout → delivery, live across four facilities.</p>
        </div>
        <div className="controls">
          {burst && <span className="muted">{burst}</span>}
          <button
            className="btn ghost"
            onClick={() => forceStockout.mutate()}
            disabled={forceStockout.isPending}
          >
            <IconZap /> Force a stockout
          </button>
          <button
            className="btn ghost"
            onClick={() => simulate.mutate(1)}
            disabled={simulate.isPending}
          >
            +1 order
          </button>
          <button
            className="btn"
            onClick={() => simulate.mutate(8)}
            disabled={simulate.isPending}
          >
            Simulate 8 orders
          </button>
        </div>
      </div>

      {metricsQuery.isError && !metrics && (
        <div style={{ marginBottom: 16 }}>
          <QueryError what="metrics" onRetry={() => metricsQuery.refetch()} />
        </div>
      )}

      <div className="grid-kpi">
        <div className="kpi">
          <div className="label">Orders today</div>
          <div className="value">{metrics?.orders_today ?? '—'}</div>
        </div>
        <div className="kpi">
          <div className="label">GMV today</div>
          <div className="value">{metrics ? compactMoney(metrics.gmv_today_cents) : '—'}</div>
        </div>
        <div className="kpi">
          <div className="label">Open orders</div>
          <div className="value">{metrics?.open_orders ?? '—'}</div>
        </div>
        <div className={`kpi ${metrics && metrics.exceptions > 0 ? 'alert' : ''}`}>
          <div className="label">Exceptions</div>
          <div className="value">{metrics?.exceptions ?? '—'}</div>
        </div>
        <div className="kpi">
          <div className="label">Fill rate</div>
          <div className="value">
            {metrics?.fill_rate_percent != null ? `${metrics.fill_rate_percent}%` : '—'}
          </div>
        </div>
        <div className="kpi">
          <div className="label">Avg → ship</div>
          <div className="value">{duration(metrics?.avg_time_to_ship_seconds ?? null)}</div>
        </div>
      </div>

      <div className="grid-main">
        <section className="card">
          <h3>Live order stream</h3>
          {eventsQuery.isError && feed.length === 0 ? (
            <QueryError what="the event stream" onRetry={() => eventsQuery.refetch()} />
          ) : (
            <div className="feed">
              {feed.length === 0 && (
                <p className="empty">
                  Quiet in here — hit <strong>Simulate</strong> to send orders through the
                  pipeline.
                </p>
              )}
              {feed.map((event) => (
                <div className="feed-row" key={event.sequence}>
                  <span className="seq">#{event.sequence}</span>
                  <span className={`chip ${eventChipClass(event.type)}`}>
                    {eventLabel(event.type)}
                  </span>
                  <Link className="cell-link" to={`/orders/${event.order_id}`}>
                    {event.order_number ?? event.order_id.slice(0, 8)}
                  </Link>
                  {typeof event.payload.carrier === 'string' && (
                    <span className="muted">{event.payload.carrier}</span>
                  )}
                  {typeof event.payload.reason === 'string' && (
                    <span className="muted">{event.payload.reason}</span>
                  )}
                  {event.payload.retry === true && <span className="muted">retry</span>}
                  <time dateTime={event.inserted_at}>{clock(event.inserted_at)}</time>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="stack">
          <section className="card">
            <h3>Pipeline funnel</h3>
            {FUNNEL.map((status) => {
              const count = metrics?.status_counts[status] ?? 0
              return (
                <div className={`funnel-row ${status}`} key={status}>
                  <span className="name">{status}</span>
                  <div className="funnel-bar">
                    <span style={{ width: `${(count / maxCount) * 100}%` }} />
                  </div>
                  <span className="count">{count}</span>
                </div>
              )
            })}
          </section>

          <section className="card">
            <h3>Inventory by facility</h3>
            {inventoryQuery.isError ? (
              <QueryError what="inventory" onRetry={() => inventoryQuery.refetch()} />
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Facility</th>
                      <th>City</th>
                      <th style={{ textAlign: 'right' }}>Available</th>
                      <th style={{ textAlign: 'right' }}>Allocated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventoryQuery.data?.snapshot.map((row) => (
                      <tr key={row.facility_id}>
                        <td style={{ fontWeight: 700 }}>{row.code}</td>
                        <td className="muted">
                          {row.city}, {row.region}
                        </td>
                        <td className="num" style={{ textAlign: 'right' }}>
                          {row.available.toLocaleString()}
                        </td>
                        <td className="num muted" style={{ textAlign: 'right' }}>
                          {row.allocated.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  )
}
