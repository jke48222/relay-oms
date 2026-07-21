import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { QueryError } from '../components/QueryError'
import { usePageTitle } from '../hooks/usePageTitle'
import { money } from '../format'

export function Products() {
  usePageTitle('Products')
  const query = useQuery({
    queryKey: ['products'],
    queryFn: ({ signal }) => api.products(signal),
  })

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Products</h1>
          <p className="page-sub">
            The catalog brands sell through Relay. Prices are snapshotted onto orders at
            purchase time, so edits here never rewrite history.
          </p>
        </div>
      </div>

      <section className="card">
        {query.isError ? (
          <QueryError what="products" onRetry={() => query.refetch()} />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Product</th>
                  <th style={{ textAlign: 'right' }}>Unit price</th>
                </tr>
              </thead>
              <tbody>
                {query.data?.map((product) => (
                  <tr key={product.id}>
                    <td className="muted">{product.sku}</td>
                    <td style={{ fontWeight: 600 }}>{product.name}</td>
                    <td className="num" style={{ textAlign: 'right' }}>
                      {money(product.unit_price_cents)}
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
