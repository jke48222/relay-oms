import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { api, ApiError } from '../api/client'
import { QueryError } from '../components/QueryError'
import { IconArrowLeft, IconPlus, IconX } from '../components/Icons'
import { usePageTitle } from '../hooks/usePageTitle'
import { money } from '../format'

const CHANNELS = ['shopify', 'amazon', 'tiktok_shop', 'b2b', 'dtc']
const REGIONS = ['GA', 'NC', 'FL', 'TN', 'NY', 'OH', 'IL', 'TX', 'CO', 'AZ', 'NV', 'CA', 'WA', 'OR']

interface LineDraft {
  key: number
  product_id: string
  quantity: number
}

let draftKey = 0

export function NewOrder() {
  usePageTitle('New order')
  const navigate = useNavigate()
  const productsQuery = useQuery({
    queryKey: ['products'],
    queryFn: ({ signal }) => api.products(signal),
  })
  const products = productsQuery.data ?? []

  const [customer, setCustomer] = useState('')
  const [channel, setChannel] = useState('shopify')
  const [city, setCity] = useState('')
  const [region, setRegion] = useState('GA')
  const [lines, setLines] = useState<LineDraft[]>([{ key: draftKey++, product_id: '', quantity: 1 }])
  const [problem, setProblem] = useState<string | null>(null)

  // One key per form session: double-clicking Place order sends the same key
  // twice, and the API replays the original instead of creating a twin.
  const idempotencyKey = useMemo(() => crypto.randomUUID(), [])

  const total = lines.reduce((sum, line) => {
    const product = products.find((p) => p.id === line.product_id)
    return product ? sum + product.unit_price_cents * line.quantity : sum
  }, 0)

  const create = useMutation({
    mutationFn: () =>
      api.createOrder({
        channel,
        customer_name: customer.trim(),
        destination_city: city.trim(),
        destination_region: region,
        line_items: lines
          .filter((l) => l.product_id)
          .map((l) => ({ product_id: l.product_id, quantity: l.quantity })),
        idempotencyKey,
      }),
    onSuccess: (result) => {
      navigate(`/orders/${result.data.id}`, {
        state: { replayed: result.meta.idempotent_replay },
      })
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        const fieldErrors = (err.body as { error?: { fields?: Record<string, string[]> } })
          ?.error?.fields
        setProblem(
          fieldErrors
            ? Object.entries(fieldErrors)
                .map(([field, msgs]) => `${field} ${msgs.join(', ')}`)
                .join(' · ')
            : `Couldn't place the order (${err.code}).`,
        )
      } else {
        setProblem("Couldn't reach the API.")
      }
    },
  })

  function updateLine(key: number, patch: Partial<LineDraft>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  }

  const valid =
    customer.trim() !== '' &&
    city.trim() !== '' &&
    lines.some((l) => l.product_id && l.quantity > 0)

  return (
    <>
      <div className="page-head">
        <h1>
          <Link to="/orders" className="back-btn" aria-label="Back to orders">
            <IconArrowLeft />
          </Link>
          New order
        </h1>
      </div>

      {problem && <div className="banner bad">{problem}</div>}

      <div className="grid-main">
        <section className="card">
          <h3>Order details</h3>
          {productsQuery.isError ? (
            <QueryError what="the catalog" onRetry={() => productsQuery.refetch()} />
          ) : (
            <div className="stack" style={{ gap: 14 }}>
              <div className="field">
                <label htmlFor="customer">Customer name</label>
                <input
                  id="customer"
                  type="text"
                  value={customer}
                  onChange={(e) => setCustomer(e.target.value)}
                  placeholder="Ada Lovelace"
                />
              </div>

              <div className="controls">
                <div className="field" style={{ flex: 2, minWidth: 160 }}>
                  <label htmlFor="city">Destination city</label>
                  <input
                    id="city"
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Atlanta"
                  />
                </div>
                <div className="field">
                  <label htmlFor="region">State</label>
                  <select id="region" value={region} onChange={(e) => setRegion(e.target.value)}>
                    {REGIONS.map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="channel">Channel</label>
                  <select
                    id="channel"
                    value={channel}
                    onChange={(e) => setChannel(e.target.value)}
                  >
                    {CHANNELS.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <div className="field" style={{ marginBottom: 8 }}>
                  <label>Line items</label>
                </div>
                <div className="stack" style={{ gap: 10 }}>
                  {lines.map((line) => (
                    <div className="controls" key={line.key} style={{ flexWrap: 'nowrap' }}>
                      <select
                        style={{ flex: 1, minWidth: 0 }}
                        value={line.product_id}
                        onChange={(e) => updateLine(line.key, { product_id: e.target.value })}
                        aria-label="Product"
                      >
                        <option value="">Choose a product…</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} — {money(p.unit_price_cents)}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min={1}
                        max={99}
                        value={line.quantity}
                        style={{ width: 76 }}
                        onChange={(e) =>
                          updateLine(line.key, { quantity: Math.max(1, Number(e.target.value)) })
                        }
                        aria-label="Quantity"
                      />
                      <button
                        className="btn ghost small"
                        onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
                        disabled={lines.length === 1}
                        aria-label="Remove line"
                      >
                        <IconX />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  className="btn ghost small"
                  style={{ marginTop: 10 }}
                  onClick={() =>
                    setLines((prev) => [...prev, { key: draftKey++, product_id: '', quantity: 1 }])
                  }
                >
                  <IconPlus /> Add item
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="card">
          <h3>Summary</h3>
          <div className="keyline">
            <div className="krow head">
              <b>Draft order</b>
              <span className="kv">{channel}</span>
            </div>
            {lines
              .filter((l) => l.product_id)
              .map((line) => {
                const product = products.find((p) => p.id === line.product_id)
                if (!product) return null
                return (
                  <div className="krow" key={line.key}>
                    <span>
                      {product.name} × {line.quantity}
                    </span>
                    <span className="kv">{money(product.unit_price_cents * line.quantity)}</span>
                  </div>
                )
              })}
            <div className="krow total">
              <span>Net payable amount</span>
              <span className="kv">{money(total)}</span>
            </div>
          </div>

          <button
            className="btn block"
            style={{ marginTop: 16 }}
            onClick={() => create.mutate()}
            disabled={!valid}
          >
            Place order
          </button>
          <p className="card-sub" style={{ marginTop: 10, marginBottom: 0 }}>
            Retries are safe: this form carries an idempotency key, so a double-click
            returns the original order instead of a duplicate.
          </p>
        </section>
      </div>
    </>
  )
}
