const MAPPING: Array<{ stord: string; relay: string; honest: string }> = [
  {
    stord: 'Elixir + Phoenix backend',
    relay: 'Phoenix 1.8 JSON API (backend/)',
    honest: 'Same framework, API-only tree',
  },
  {
    stord: 'React + TypeScript frontend',
    relay: 'Vite + React 19 + TS SPA (frontend/)',
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
    honest: 'Identical mechanism',
  },
  {
    stord: 'Docker + Kubernetes (GKE)',
    relay: 'Dockerfiles + k8s manifests in deploy/',
    honest: 'Written and lintable, not run locally — props, labeled as such',
  },
  {
    stord: 'CircleCI → Harness',
    relay: 'GitHub Actions: mix test, format, tsc, vitest',
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
 Fulfillment.Pipeline (async consumer)
      │ allocate: FOR UPDATE on inventory rows,
      │ pick facility by zone → allocated | exception
      ▼
 picking ─► packed ─► shipped (stock consumed, tracking cut)
      │                              │
      ▼                              ▼
 order_events #n+1…            delivered`

export function About() {
  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Why it's built this way</div>
          <h1>Architecture</h1>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 16, maxWidth: 900 }}>
        <section className="card">
          <h3>What Relay is</h3>
          <p style={{ marginTop: 0 }}>
            A small order-management and fulfillment system — checkout to delivery —
            built deliberately on Stord's stack to learn how Stord builds. Orders
            arrive over a JSON API, a state machine walks them through
            <span className="mono"> received → allocated → picking → packed → shipped → delivered</span>,
            inventory is reserved transactionally across four facilities, and every
            state change is an event that ends up in the feed on the dashboard —
            live, over a Phoenix Channel.
          </p>
          <p style={{ marginBottom: 0 }}>
            Nothing here is mocked: the pipeline you watch on the dashboard is an
            async consumer reacting to committed events, racing allocations really
            do lose when stock runs out (try burst-ordering the sunglasses), and a
            cancelled order really returns its units to the pool.
          </p>
        </section>

        <section className="card">
          <h3>Stack, mapped to Stord's</h3>
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
        </section>

        <section className="callout">
          <div className="lab">PubSub here = Kafka there</div>
          <p style={{ margin: 0 }}>
            Order events are written to an append-only <span className="mono">order_events</span>{' '}
            table <em>in the same transaction</em> as the state they describe — the
            transactional outbox pattern — then fanned out after commit. At Relay's
            scale the fan-out is <span className="mono">Phoenix.PubSub</span> inside one BEAM
            node. At Stord's scale you'd put a relay process on that table and produce
            to Kafka, and the consumers (allocation, notifications, analytics) become
            separate services with their own offsets. The seam is already in the code:
            producers never call consumers.
          </p>
        </section>

        <section className="card">
          <h3>Life of an order</h3>
          <pre className="code">{FLOW}</pre>
        </section>

        <section className="card">
          <h3>Decisions worth defending</h3>
          <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 8 }}>
            <li>
              <strong>Oversell is stopped twice.</strong> Allocation locks the inventory
              rows (<span className="mono">SELECT … FOR UPDATE</span>) and re-reads counts
              under the lock; a DB check constraint
              (<span className="mono">allocated &lt;= on_hand</span>) backstops any bug that
              slips past.
            </li>
            <li>
              <strong>Idempotent creates.</strong> Retrying{' '}
              <span className="mono">POST /orders</span> with the same{' '}
              <span className="mono">Idempotency-Key</span> replays the original order —
              a double-clicked checkout can't ship twice.
            </li>
            <li>
              <strong>The state machine is the authority.</strong> Pipeline timers race
              cancellations all the time; whoever loses gets a clean{' '}
              <span className="mono">invalid_transition</span> and drops out. No
              compensating hacks.
            </li>
            <li>
              <strong>Prices are snapshotted onto line items</strong> at order time —
              catalog edits can't rewrite history.
            </li>
            <li>
              <strong>Tests target failure modes</strong>: oversell races, allocation
              exceptions, illegal transitions, idempotency replays — not just happy
              paths.
            </li>
          </ul>
        </section>
      </div>
    </>
  )
}
