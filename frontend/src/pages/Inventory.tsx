import { useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { QueryError } from '../components/QueryError'
import { usePageTitle } from '../hooks/usePageTitle'

export function Inventory() {
  usePageTitle('Inventory')
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: ['inventory'],
    queryFn: ({ signal }) => api.inventory(signal),
  })
  const [received, setReceived] = useState<string | null>(null)

  const receive = useMutation({
    mutationFn: api.receiveStock,
    onSuccess: (item) => {
      setReceived(`Received stock: ${item.product.sku} at ${item.facility.code} → ${item.on_hand} on hand`)
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
    },
  })

  function submitReceive(e: FormEvent<HTMLFormElement>, facilityId: string, productId: string) {
    e.preventDefault()
    const input = e.currentTarget.elements.namedItem('qty') as HTMLInputElement
    const quantity = Number(input.value)
    if (quantity > 0) {
      receive.mutate({ facility_id: facilityId, product_id: productId, quantity })
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Inventory</h1>
          <p className="page-sub">
            Four facilities, one truth: available = on hand − allocated. Receiving is
            the only way stock ever goes up.
          </p>
        </div>
      </div>

      {received && <div className="banner good">{received}</div>}

      <div className="grid-kpi" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {query.data?.snapshot.map((row) => (
          <div className="kpi" key={row.facility_id}>
            <div className="label">
              {row.code} · {row.city}, {row.region}
            </div>
            <div className="value">{row.available.toLocaleString()}</div>
            <div className="muted" style={{ fontSize: 12 }}>
              {row.allocated.toLocaleString()} allocated · {row.on_hand.toLocaleString()} on hand
            </div>
          </div>
        ))}
      </div>

      <section className="card">
        {query.isError ? (
          <QueryError what="inventory" onRetry={() => query.refetch()} />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Facility</th>
                  <th>SKU</th>
                  <th>Product</th>
                  <th style={{ textAlign: 'right' }}>On hand</th>
                  <th style={{ textAlign: 'right' }}>Allocated</th>
                  <th style={{ textAlign: 'right' }}>Available</th>
                  <th style={{ textAlign: 'right' }}>Receive</th>
                </tr>
              </thead>
              <tbody>
                {query.data?.data.map((item) => (
                  <tr key={item.id}>
                    <td style={{ fontWeight: 700 }}>{item.facility.code}</td>
                    <td className="muted">{item.product.sku}</td>
                    <td>{item.product.name}</td>
                    <td className="num" style={{ textAlign: 'right' }}>
                      {item.on_hand.toLocaleString()}
                    </td>
                    <td className="num muted" style={{ textAlign: 'right' }}>
                      {item.allocated.toLocaleString()}
                    </td>
                    <td
                      className="num"
                      style={{
                        textAlign: 'right',
                        color:
                          item.available <= 0
                            ? 'var(--red)'
                            : item.available < 15
                              ? 'var(--amber)'
                              : undefined,
                        fontWeight: item.available < 15 ? 800 : undefined,
                      }}
                    >
                      {item.available.toLocaleString()}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <form
                        className="controls"
                        style={{ justifyContent: 'flex-end', flexWrap: 'nowrap' }}
                        onSubmit={(e) => submitReceive(e, item.facility.id, item.product.id)}
                      >
                        <input
                          type="number"
                          name="qty"
                          min={1}
                          max={999}
                          defaultValue={25}
                          style={{ width: 72, padding: '7px 10px' }}
                          aria-label={`Quantity to receive for ${item.product.sku} at ${item.facility.code}`}
                        />
                        <button className="btn ghost small" disabled={receive.isPending}>
                          Receive
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}
