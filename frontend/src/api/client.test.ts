import { afterEach, describe, expect, it, vi } from 'vitest'
import { api, ApiError } from './client'

function mockFetch(status: number, body: unknown) {
  const fn = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('api client', () => {
  it('unwraps successful envelopes', async () => {
    mockFetch(200, { data: { orders_today: 4 } })
    const metrics = await api.metrics()
    expect(metrics).toEqual({ orders_today: 4 })
  })

  it('throws a typed ApiError carrying the backend error code', async () => {
    mockFetch(409, { error: { code: 'invalid_transition', from: 'packed', to: 'cancelled' } })

    const failure = api.cancelOrder('some-id')
    await expect(failure).rejects.toBeInstanceOf(ApiError)
    await expect(failure).rejects.toMatchObject({ status: 409, code: 'invalid_transition' })
  })

  it('falls back to unknown_error when the body has no envelope', async () => {
    mockFetch(500, { boom: true })
    await expect(api.products()).rejects.toMatchObject({ code: 'unknown_error' })
  })

  it('sends the idempotency key as a header', async () => {
    const fetchMock = mockFetch(201, { data: { id: 'x' }, meta: { idempotent_replay: false } })

    await api.createOrder({
      channel: 'shopify',
      customer_name: 'A',
      destination_city: 'B',
      destination_region: 'GA',
      line_items: [{ product_id: 'p', quantity: 1 }],
      idempotencyKey: 'key-123',
    })

    const init = fetchMock.mock.calls[0][1] as RequestInit
    const headers = init.headers as Record<string, string>
    expect(headers['idempotency-key']).toBe('key-123')
    // Regression: extra headers must MERGE with content-type, not replace it —
    // losing it makes the server parse an empty body (422 no_line_items).
    expect(headers['content-type']).toBe('application/json')
  })
})
