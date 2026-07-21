import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'

export function Inventory() {
  const { data } = useQuery({ queryKey: ['inventory'], queryFn: api.inventory })

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Four facilities, one truth</div>
          <h1>Inventory</h1>
        </div>
      </div>

      <div className="grid-kpi" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {data?.snapshot.map((row) => (
          <div className="kpi" key={row.facility_id}>
            <div className="label">
              {row.code} · {row.city}, {row.region}
            </div>
            <div className="value">{row.available.toLocaleString()}</div>
            <div className="mono muted" style={{ fontSize: 11 }}>
              {row.allocated.toLocaleString()} allocated · {row.on_hand.toLocaleString()} on hand
            </div>
          </div>
        ))}
      </div>

      <section className="card">
        <table>
          <thead>
            <tr>
              <th>Facility</th>
              <th>SKU</th>
              <th>Product</th>
              <th style={{ textAlign: 'right' }}>On hand</th>
              <th style={{ textAlign: 'right' }}>Allocated</th>
              <th style={{ textAlign: 'right' }}>Available</th>
            </tr>
          </thead>
          <tbody>
            {data?.data.map((item) => (
              <tr key={item.id}>
                <td className="mono">{item.facility.code}</td>
                <td className="mono">{item.product.sku}</td>
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
                        ? 'var(--bad)'
                        : item.available < 15
                          ? 'var(--warn)'
                          : undefined,
                    fontWeight: item.available < 15 ? 700 : undefined,
                  }}
                >
                  {item.available.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  )
}
