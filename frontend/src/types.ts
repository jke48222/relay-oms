// Mirrors backend/lib/relay_web/controllers/api/json.ex — the API contract.

export type OrderStatus =
  | 'received'
  | 'allocated'
  | 'picking'
  | 'packed'
  | 'shipped'
  | 'delivered'
  | 'exception'
  | 'cancelled'

export const ORDER_STATUSES: OrderStatus[] = [
  'received',
  'allocated',
  'picking',
  'packed',
  'shipped',
  'delivered',
  'exception',
  'cancelled',
]

export type Channel = 'shopify' | 'amazon' | 'tiktok_shop' | 'b2b' | 'dtc'

export interface Product {
  id: string
  sku: string
  name: string
  unit_price_cents: number
}

export interface Facility {
  id: string
  code: string
  name: string
  city: string
  region: string
}

export interface InventoryItem {
  id: string
  facility: Facility
  product: Product
  on_hand: number
  allocated: number
  available: number
}

export interface FacilitySnapshot {
  facility_id: string
  code: string
  name: string
  city: string
  region: string
  on_hand: number
  allocated: number
  available: number
}

export interface LineItem {
  id: string
  product_id: string
  sku: string
  name: string
  quantity: number
  unit_price_cents: number
}

export interface Shipment {
  id: string
  carrier: string
  tracking_number: string
  shipped_at: string
  delivered_at: string | null
}

export interface Order {
  id: string
  number: string
  status: OrderStatus
  channel: Channel
  customer_name: string
  destination: { city: string; region: string }
  total_cents: number
  placed_at: string
  facility: Facility | null
  line_items: LineItem[]
  shipment: Shipment | null
}

export interface OrderEvent {
  id: string
  sequence: number
  type: string
  order_id: string
  order_number: string | null
  payload: Record<string, unknown>
  inserted_at: string
}

export interface OrderWithEvents extends Order {
  events: OrderEvent[]
}

export interface Metrics {
  orders_today: number
  gmv_today_cents: number
  open_orders: number
  exceptions: number
  fill_rate_percent: number | null
  avg_time_to_ship_seconds: number | null
  status_counts: Record<OrderStatus, number>
}

export interface Page<T> {
  data: T[]
  meta: { page: number; page_size: number; total: number }
}
