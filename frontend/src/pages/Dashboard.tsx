import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { useRealtime } from '../realtime/RealtimeProvider'
import { eventChipClass } from '../components/StatusChip'
import { clock, compactMoney, duration, eventLabel } from '../format'
import type { OrderEvent, OrderStatus } from '../types'

const FUNNEL: OrderStatus[] = [
  'received',
  'allocated',
  'picking',
  'packed',
  'shipped',
  'delivered',
  'exception',
]

export function Dashboard() {
  const { events: liveEvents, metrics: liveMetrics } = useRealtime()
  const [lastBurst, setLastBurst] = useState<number | null>(null)

  // Fall back to fetched data before the socket delivers its first push.
  const { data: fetchedMetrics } = useQuery({ queryKey: ['metrics'], queryFn: api.metrics })
  const { data: recentEvents } = useQuery({
    queryKey: ['events'],
    queryFn: () => api.events(30),
  })
  const { data: inventory } = useQuery({ queryKey: ['inventory'], queryFn: api.inventory })

  const metrics = liveMetrics ?? fetchedMetrics

  const feed = useMemo(() => {
    const seen = new Set<number>()
    const merged: OrderEvent[] = []
    for (const event of [...liveEvents, ...(recentEvents ?? [])]) {
      if (!seen.has(event.sequence)) {
        seen.add(event.sequence)
        merged.push(event)
      }
    }
    return merged.sort((a, b) => b.sequence - a.sequence).slice(0, 60)
  }, [liveEvents, recentEvents])

  const simulate = useMutation({
    mutationFn: api.simulate,
    onSuccess: (result) => setLastBurst(result.count),
  })

  const maxCount = Math.max(1, ...FUNNEL.map((s) => metrics?.status_counts[s] ?? 0))

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Checkout → delivery</div>
          <h1>Fulfillment dashboard</h1>
        </div>
        <div className="controls">
          {lastBurst != null && (
            <span className="mono muted">+{lastBurst} orders in flight</span>
          )}
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

      <div className="grid-kpi">
        <div className="kpi">
          <div className="label">Orders today</div>
          <div className="value">{metrics?.orders_today ?? '—'}</div>
        </div>
        <div className="kpi">
          <div className="label">GMV today</div>
          <div className="value">
            {metrics ? compactMoney(metrics.gmv_today_cents) : '—'}
          </div>
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
          <div className="feed">
            {feed.length === 0 && (
              <p className="muted">
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
                <Link className="mono" to={`/orders/${event.order_id}`}>
                  {event.order_number ?? event.order_id.slice(0, 8)}
                </Link>
                {typeof event.payload.carrier === 'string' && (
                  <span className="mono muted">{event.payload.carrier}</span>
                )}
                {typeof event.payload.reason === 'string' && (
                  <span className="mono muted">{event.payload.reason}</span>
                )}
                <time>{clock(event.inserted_at)}</time>
              </div>
            ))}
          </div>
        </section>

        <div style={{ display: 'grid', gap: 16 }}>
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
                {inventory?.snapshot.map((row) => (
                  <tr key={row.facility_id}>
                    <td className="mono">{row.code}</td>
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
          </section>
        </div>
      </div>
    </>
  )
}
