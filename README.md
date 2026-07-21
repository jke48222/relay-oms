# Relay — an order management & fulfillment console, built on Stord's stack

Checkout → delivery, end to end: orders arrive over a JSON API, an
event-driven pipeline allocates inventory across four fulfillment centers and
walks each order through `received → allocated → picking → packed → shipped →
delivered`, and a React dashboard watches the whole thing happen live over a
Phoenix Channel.

Built as a learning project with one rule: **use the stack Stord actually
runs** — Elixir/Phoenix + Postgres behind a versioned JSON API, React +
TypeScript in front, event-driven in the middle, Docker/Kubernetes/CI around
it.

| Layer | This repo |
|---|---|
| Backend | Elixir 1.20 / Phoenix 1.8 (API-only) — `backend/` |
| Frontend | React 19 + TypeScript + Vite — `frontend/` |
| Database | PostgreSQL 16 via Ecto — row locks + check constraints against oversell |
| Events | Transactional outbox (`order_events`) → PubSub → async fulfillment worker |
| Real-time | Phoenix Channels → live dashboard |
| Infra | Dockerfiles, docker-compose, k8s manifests — `deploy/` |
| CI | GitHub Actions: `mix format` + `mix test`, `tsc` + vitest + build |

## Run it

Prereqs: Elixir ≥ 1.15, Node ≥ 20, PostgreSQL running locally.

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

Open http://localhost:5173, press **Simulate 8 orders**, and watch the
pipeline move them in real time. Roughly 1 in 7 simulated orders chases a
deliberately scarce SKU and fails allocation — that's the red `exception`
lane doing its job, not a bug.

```sh
# tests
cd backend && mix test        # domain + API + channel (failure modes first)
cd frontend && npm run test   # vitest
```

## The interesting parts

- **Transactional outbox** — every state change and the event describing it
  commit in one transaction ([`workflow.ex`](backend/lib/relay/orders/workflow.ex)),
  then fan out on PubSub after commit. Swap the fan-out for a Kafka producer
  and the consumers for consumer groups, and the pattern is Stord's.
- **Allocation under row locks** — [`inventory.ex`](backend/lib/relay/inventory.ex)
  locks stock rows `FOR UPDATE`, prefers the facility in the destination's
  shipping zone, and lets the second order racing for the last units lose
  cleanly. A DB check constraint (`allocated <= on_hand`) backstops it.
- **The state machine is the authority** — pipeline timers race
  cancellations; losers get `{:error, {:invalid_transition, ...}}` and drop
  out ([`state_machine.ex`](backend/lib/relay/orders/state_machine.ex)).
- **Idempotent creates** — retry `POST /api/v1/orders` with the same
  `Idempotency-Key` and you get the original order back, not a duplicate.
- **Tests target failure modes** — oversell, allocation races, illegal
  transitions, idempotency replays
  ([`workflow_test.exs`](backend/test/relay/orders/workflow_test.exs)).

Full write-up: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — including what
would change at real scale (PubSub → Kafka, one node → services, timers →
real WMS signals).

## API sketch

```
GET  /api/v1/health           liveness/readiness (pings Postgres)
GET  /api/v1/metrics          dashboard KPIs
GET  /api/v1/events?limit=50  recent event stream
POST /api/v1/simulate         {"count": 8} — demo traffic through the real pipeline
GET  /api/v1/orders           ?status=&channel=&page=&page_size=
POST /api/v1/orders           Idempotency-Key header honored
GET  /api/v1/orders/:id       order + full event timeline
POST /api/v1/orders/:id/cancel
GET  /api/v1/products | /facilities | /inventory
WS   /socket → dashboard:lobby   order_event + metrics pushes
```

---

*Design system carried over from my Stord interview field guide — same
indigo, same type. Not affiliated with Stord; built to learn their stack.*
