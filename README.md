# Relay — an order management & fulfillment console, built on Stord's stack

![Relay dashboard — live order stream, pipeline funnel, inventory by facility](docs/media/dashboard.png)

Checkout → delivery, end to end: orders arrive over a JSON API, an
event-driven pipeline allocates inventory across four fulfillment centers and
walks each order through `received → allocated → picking → packed → shipped →
delivered`, and a React console watches the whole thing happen live over a
Phoenix Channel.

Built as a learning project with one rule: **use the stack Stord actually
runs** — Elixir/Phoenix + Postgres behind a versioned JSON API, React +
TypeScript in front, event-driven in the middle, Docker/Kubernetes/CI around
it.

| Layer | This repo |
|---|---|
| Backend | Elixir 1.20 / Phoenix 1.8 (API-only) — `backend/` |
| Frontend | React 19 + strict TypeScript + Vite — `frontend/` |
| Database | PostgreSQL 16 via Ecto — row locks + check constraints against oversell |
| Events | Transactional outbox (`order_events`) → PubSub → async fulfillment worker that **rehydrates from the DB on boot** |
| Real-time | Phoenix Channels → live dashboard, exception badge, debounced metrics |
| Infra | Dockerfiles, docker-compose (with release migrations), k8s manifests + migration Job — `deploy/` |
| CI | GitHub Actions: `mix format` + compile `--warnings-as-errors` + `mix test` · oxlint + `tsc --strict` + vitest + build |

## Run it

Prereqs: Elixir ≥ 1.17, Node ≥ 20, PostgreSQL running locally.

```sh
# backend — terminal 1
cd backend
mix setup            # deps, create DB, migrate, seed
mix phx.server       # API on :4000

# frontend — terminal 2
cd frontend
npm install
npm run dev          # SPA on :5173, proxies /api + /socket to :4000
```

Open http://localhost:5173 and press **Simulate 8 orders** — then run the
whole failure-recovery arc yourself:

1. **Force a stockout** — places an order for 99 units of a deliberately
   scarce SKU. Allocation fails; the order parks in the red `exception` lane
   and the topbar bell starts counting.
2. **Receive stock** on the Inventory page at the Dallas facility.
3. **Retry allocation** on the order — watch the timeline record
   `received (retry) → allocated → picking → packed → shipped → delivered`,
   fulfilled from the facility you just restocked.

Every step of that arc is real state in Postgres, real events in the outbox,
and a real async worker doing the moving.

```sh
# tests
cd backend && mix test        # 39 tests — failure modes first
cd frontend && npm run test   # 13 vitest tests
```

## The interesting parts

- **Transactional outbox** — every state change and the event describing it
  commit in one transaction ([`workflow.ex`](backend/lib/relay/orders/workflow.ex)),
  then fan out on PubSub after commit. Swap the fan-out for a Kafka producer
  and the consumers for consumer groups, and the pattern is Stord's.
- **Crash-safe pipeline** — timers are process-local, so the fulfillment
  worker re-scans non-terminal orders on boot
  ([`pipeline.ex`](backend/lib/relay/fulfillment/pipeline.ex)) — the same
  reason Kafka consumers track offsets. Restarts strand nothing and reserved
  stock never leaks.
- **Allocation under row locks** — [`inventory.ex`](backend/lib/relay/inventory.ex)
  locks stock rows `FOR UPDATE`, prefers the facility in the destination's
  shipping zone, and lets the second order racing for the last units lose
  cleanly. A DB check constraint (`allocated <= on_hand`) backstops it.
- **The state machine is the authority** — pipeline timers race
  cancellations; losers get `{:error, {:invalid_transition, ...}}` and drop
  out ([`state_machine.ex`](backend/lib/relay/orders/state_machine.ex)).
- **Idempotent creates** — the New Order form ships an `Idempotency-Key`;
  double-clicking Place order returns the original order, and the UI says so.
- **Metrics read the event log** — fill rate counts allocation attempts from
  immutable events ([`metrics.ex`](backend/lib/relay/metrics.ex)), so
  statuses moving on can't skew history.
- **Tests target failure modes** — oversell races, no-partial-reservation,
  illegal transitions, idempotency replays, pipeline rehydration
  ([`workflow_test.exs`](backend/test/relay/orders/workflow_test.exs),
  [`pipeline_test.exs`](backend/test/relay/fulfillment/pipeline_test.exs)).

Full write-up: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — including what
would change at real scale (PubSub → Kafka, one node → services, timers →
real WMS signals).

## API sketch

```
GET  /api/v1/health              liveness/readiness (pings Postgres)
GET  /api/v1/metrics             dashboard KPIs
GET  /api/v1/events?limit=50     recent event stream
POST /api/v1/simulate            {"count": 8} — demo traffic through the real pipeline
GET  /api/v1/orders              ?status=&channel=&number=&page=&page_size=
POST /api/v1/orders              Idempotency-Key header honored (201 create / 200 replay)
GET  /api/v1/orders/:id          order + full event timeline
POST /api/v1/orders/:id/cancel   guarded by the state machine
POST /api/v1/orders/:id/retry    exception → back through allocation
POST /api/v1/inventory/receive   inbound stock
GET  /api/v1/products | /facilities | /inventory
WS   /socket → dashboard:lobby   order_event + debounced metrics pushes
```

---

*UI is a ground-up admin-console design (violet/lavender, Plus Jakarta Sans —
OFL-licensed and self-hosted). Not affiliated with Stord; built to learn
their stack.*
