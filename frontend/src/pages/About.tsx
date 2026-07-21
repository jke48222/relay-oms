import { usePageTitle } from '../hooks/usePageTitle'

const MAPPING: Array<{ stord: string; relay: string; honest: string }> = [
  {
    stord: 'Elixir + Phoenix backend',
    relay: 'Phoenix 1.8 JSON API (backend/)',
    honest: 'Same framework, API-only tree',
  },
  {
    stord: 'React + TypeScript frontend',
    relay: 'Vite + React 19 + strict TS SPA (frontend/)',
    honest: 'Same tier split: SPA over a versioned API',
  },
  {
    stord: 'Postgres (Cloud SQL)',
    relay: 'Postgres 16 via Ecto',
    honest: 'FOR UPDATE row locks + check constraints do the oversell math',
  },
  {
    stord: 'Kafka (Confluent)',
    relay: 'Transactional outbox → Phoenix.PubSub',
    honest: 'Same pattern, in-process transport — see the callout below',
  },
  {
    stord: 'Event-driven microservices',
    relay: 'Fulfillment pipeline consumes events, never called directly',
    honest: 'One BEAM node here; the seams are where services would split',
  },
  {
    stord: 'Phoenix Channels / real-time',
    relay: 'DashboardChannel streams every event to this UI',
    honest: 'Identical mechanism, debounced metric snapshots',
  },
  {
    stord: 'Docker + Kubernetes (GKE)',
    relay: 'Dockerfiles + k8s manifests in deploy/',
    honest: 'Written and lintable, not run locally — props, labeled as such',
  },
  {
    stord: 'CircleCI → Harness',
    relay: 'GitHub Actions: mix test, format, tsc, vitest, lint',
    honest: 'Different vendor, same gate',
  },
]

const FLOW = `POST /api/v1/orders
      │  one transaction:
      │  INSERT order (received) + INSERT order_events (outbox)
      ▼
 Phoenix.PubSub ──────────────► DashboardChannel ──► this browser
      │
      ▼
 Fulfillment.Pipeline (async consumer; rehydrates from
      │                the DB on boot — restarts strand nothing)
      │ allocate: FOR UPDATE on inventory rows,
      │ pick facility by zone → allocated | exception
      ▼
 picking ─► packed ─► shipped (stock consumed, tracking cut)
      │                              │
      ▼                              ▼
 order_events #n+1…            delivered

 exception ─► (receive stock) ─► retry ─► re-enters at allocate`

export function About() {
  usePageTitle('Architecture')
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Architecture</h1>
          <p className="page-sub">Why Relay is built this way — and what's honest about it.</p>
        </div>
      </div>

      <div className="stack" style={{ maxWidth: 920 }}>
        <section className="card">
          <h3>What Relay is</h3>
          <p style={{ marginTop: 0 }}>
            A small order-management and fulfillment system — checkout to delivery —
            built deliberately on Stord's stack to learn how Stord builds. Orders arrive
            over a JSON API, a state machine walks them through
            <strong> received → allocated → picking → packed → shipped → delivered</strong>,
            inventory is reserved transactionally across four facilities, and every state
            change is an event that ends up in the live feed on the Overview page.
          </p>
          <p style={{ marginBottom: 0 }}>
            Nothing here is mocked: the pipeline is an async consumer reacting to
            committed events, racing allocations really do lose when stock runs out (try
            <strong> Force a stockout</strong>), a cancelled order really returns its
            units, and a parked exception really re-enters the pipeline after you
            receive stock and retry.
          </p>
        </section>

        <section className="card">
          <h3>Stack, mapped to Stord's</h3>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Stord runs</th>
                  <th>Relay runs</th>
                  <th>The honest caveat</th>
                </tr>
              </thead>
              <tbody>
                {MAPPING.map((row) => (
                  <tr key={row.stord}>
                    <td style={{ fontWeight: 700 }}>{row.stord}</td>
                    <td>{row.relay}</td>
                    <td className="muted">{row.honest}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card" style={{ background: 'var(--primary-wash)' }}>
          <h3 style={{ color: 'var(--primary-deep)' }}>PubSub here = Kafka there</h3>
          <p style={{ margin: 0 }}>
            Order events are written to an append-only <strong>order_events</strong> table{' '}
            <em>in the same transaction</em> as the state they describe — the transactional
            outbox pattern — then fanned out after commit. At Relay's scale the fan-out is
            Phoenix.PubSub inside one BEAM node. At Stord's scale you'd put a relay process
            on that table and produce to Kafka, and the consumers (allocation,
            notifications, analytics) become separate services with their own offsets. The
            seam is already in the schema: the monotonic <strong>sequence</strong> column
            is the offset analog, and the pipeline already rehydrates from the log on boot
            the way a consumer group resumes from its offset.
          </p>
        </section>

        <section className="card">
          <h3>Life of an order</h3>
          <pre className="code">{FLOW}</pre>
        </section>

        <section className="card">
          <h3>Decisions worth defending</h3>
          <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 10 }}>
            <li>
              <strong>Oversell is stopped twice.</strong> Allocation locks the inventory
              rows (SELECT … FOR UPDATE) and re-reads counts under the lock; a DB check
              constraint (allocated ≤ on_hand) backstops any bug that slips past.
            </li>
            <li>
              <strong>Restarts strand nothing.</strong> Timers are process-local, so the
              pipeline rehydrates from the database on boot — in-flight orders resume,
              reserved stock never leaks.
            </li>
            <li>
              <strong>Idempotent creates.</strong> Retrying POST /orders with the same
              Idempotency-Key replays the original order — the New order form demos it
              on a double-click.
            </li>
            <li>
              <strong>The state machine is the authority.</strong> Pipeline timers race
              cancellations constantly; whoever loses gets a clean invalid_transition and
              drops out.
            </li>
            <li>
              <strong>Prices are snapshotted onto line items</strong> at order time —
              catalog edits can't rewrite history.
            </li>
            <li>
              <strong>Metrics read the event log.</strong> Fill rate counts allocation
              attempts from immutable events, so statuses moving on can't skew it.
            </li>
            <li>
              <strong>Tests target failure modes</strong>: oversell races, allocation
              exceptions, illegal transitions, idempotency replays, pipeline rehydration.
            </li>
          </ul>
        </section>
      </div>
    </>
  )
}
