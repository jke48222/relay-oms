import type {
  Facility,
  FacilitySnapshot,
  InventoryItem,
  Metrics,
  Order,
  OrderEvent,
  OrderWithEvents,
  Page,
  Product,
} from '../types'

const BASE = '/api/v1'

export class ApiError extends Error {
  status: number
  code: string
  body: unknown

  constructor(status: number, code: string, body: unknown) {
    super(`${status} ${code}`)
    this.status = status
    this.code = code
    this.body = body
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'content-type': 'application/json', ...init?.headers },
    ...init,
  })

  const body = res.status === 204 ? null : await res.json()

  if (!res.ok) {
    const code =
      (body as { error?: { code?: string } })?.error?.code ?? 'unknown_error'
    throw new ApiError(res.status, code, body)
  }

  return body as T
}

export const api = {
  metrics: () => request<{ data: Metrics }>('/metrics').then((r) => r.data),

  products: () => request<{ data: Product[] }>('/products').then((r) => r.data),

  facilities: () =>
    request<{ data: Facility[] }>('/facilities').then((r) => r.data),

  inventory: () =>
    request<{ data: InventoryItem[]; snapshot: FacilitySnapshot[] }>('/inventory'),

  events: (limit = 40) =>
    request<{ data: OrderEvent[] }>(`/events?limit=${limit}`).then((r) => r.data),

  orders: (params: { status?: string; channel?: string; page?: number; page_size?: number }) => {
    const qs = new URLSearchParams()
    if (params.status) qs.set('status', params.status)
    if (params.channel) qs.set('channel', params.channel)
    if (params.page) qs.set('page', String(params.page))
    if (params.page_size) qs.set('page_size', String(params.page_size))
    return request<Page<Order>>(`/orders?${qs}`)
  },

  order: (id: string) =>
    request<{ data: OrderWithEvents }>(`/orders/${id}`).then((r) => r.data),

  createOrder: (input: {
    channel: string
    customer_name: string
    destination_city: string
    destination_region: string
    line_items: { product_id: string; quantity: number }[]
    idempotencyKey?: string
  }) =>
    request<{ data: Order; meta: { idempotent_replay: boolean } }>('/orders', {
      method: 'POST',
      body: JSON.stringify(input),
      headers: input.idempotencyKey
        ? { 'idempotency-key': input.idempotencyKey }
        : undefined,
    }),

  cancelOrder: (id: string) =>
    request<{ data: Order }>(`/orders/${id}/cancel`, { method: 'POST' }).then(
      (r) => r.data,
    ),

  simulate: (count: number) =>
    request<{ data: { created: string[]; count: number } }>('/simulate', {
      method: 'POST',
      body: JSON.stringify({ count }),
    }).then((r) => r.data),
}
