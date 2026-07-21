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
  // init spreads FIRST: merged headers must win, or a caller passing extra
  // headers (e.g. idempotency-key) would silently drop content-type and the
  // server would parse an empty body.
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...init?.headers },
  })

  const body = res.status === 204 ? null : await res.json()

  if (!res.ok) {
    const code =
      (body as { error?: { code?: string } })?.error?.code ?? 'unknown_error'
    throw new ApiError(res.status, code, body)
  }

  return body as T
}

export interface OrderListParams {
  status?: string
  channel?: string
  number?: string
  page?: number
  page_size?: number
}

// GET helpers accept the React Query AbortSignal so superseded refetches
// cancel their in-flight requests instead of racing them.
export const api = {
  metrics: (signal?: AbortSignal) =>
    request<{ data: Metrics }>('/metrics', { signal }).then((r) => r.data),

  products: (signal?: AbortSignal) =>
    request<{ data: Product[] }>('/products', { signal }).then((r) => r.data),

  facilities: (signal?: AbortSignal) =>
    request<{ data: Facility[] }>('/facilities', { signal }).then((r) => r.data),

  inventory: (signal?: AbortSignal) =>
    request<{ data: InventoryItem[]; snapshot: FacilitySnapshot[] }>('/inventory', {
      signal,
    }),

  events: (limit = 40, signal?: AbortSignal) =>
    request<{ data: OrderEvent[] }>(`/events?limit=${limit}`, { signal }).then(
      (r) => r.data,
    ),

  orders: (params: OrderListParams, signal?: AbortSignal) => {
    const qs = new URLSearchParams()
    if (params.status) qs.set('status', params.status)
    if (params.channel) qs.set('channel', params.channel)
    if (params.number) qs.set('number', params.number)
    if (params.page) qs.set('page', String(params.page))
    if (params.page_size) qs.set('page_size', String(params.page_size))
    return request<Page<Order>>(`/orders?${qs}`, { signal })
  },

  order: (id: string, signal?: AbortSignal) =>
    request<{ data: OrderWithEvents }>(`/orders/${id}`, { signal }).then(
      (r) => r.data,
    ),

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

  retryOrder: (id: string) =>
    request<{ data: Order }>(`/orders/${id}/retry`, { method: 'POST' }).then(
      (r) => r.data,
    ),

  receiveStock: (input: { facility_id: string; product_id: string; quantity: number }) =>
    request<{ data: InventoryItem }>('/inventory/receive', {
      method: 'POST',
      body: JSON.stringify(input),
    }).then((r) => r.data),

  simulate: (count: number) =>
    request<{ data: { created: string[]; count: number } }>('/simulate', {
      method: 'POST',
      body: JSON.stringify({ count }),
    }).then((r) => r.data),
}
