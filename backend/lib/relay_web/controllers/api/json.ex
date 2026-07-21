defmodule RelayWeb.API.JSON do
  @moduledoc """
  Serializers for every API resource. Kept in one module: the shapes are
  small, and seeing them side by side is the fastest way to review the API
  contract.
  """

  alias Relay.Catalog.Product
  alias Relay.Events.OrderEvent
  alias Relay.Fulfillment.Shipment
  alias Relay.Inventory.{Facility, InventoryItem}
  alias Relay.Orders.{LineItem, Order}

  def product(%Product{} = p) do
    %{id: p.id, sku: p.sku, name: p.name, unit_price_cents: p.unit_price_cents}
  end

  def facility(%Facility{} = f) do
    %{id: f.id, code: f.code, name: f.name, city: f.city, region: f.region}
  end

  def inventory_item(%InventoryItem{} = i) do
    %{
      id: i.id,
      facility: facility(i.facility),
      product: product(i.product),
      on_hand: i.on_hand,
      allocated: i.allocated,
      available: InventoryItem.available(i)
    }
  end

  def order(%Order{} = o) do
    %{
      id: o.id,
      number: o.number,
      status: o.status,
      channel: o.channel,
      customer_name: o.customer_name,
      destination: %{city: o.destination_city, region: o.destination_region},
      total_cents: o.total_cents,
      placed_at: o.placed_at,
      facility: maybe(o.facility, &facility/1),
      line_items: Enum.map(o.line_items, &line_item/1),
      shipment: maybe(o.shipment, &shipment/1)
    }
  end

  # nil and %Ecto.Association.NotLoaded{} both serialize as null.
  defp maybe(nil, _fun), do: nil
  defp maybe(%Ecto.Association.NotLoaded{}, _fun), do: nil
  defp maybe(value, fun), do: fun.(value)

  @doc "Full order plus its event timeline — the show endpoint."
  def order_with_events(%Order{} = o) do
    Map.put(order(o), :events, Enum.map(o.events, &event/1))
  end

  def line_item(%LineItem{} = li) do
    %{
      id: li.id,
      product_id: li.product_id,
      sku: li.product.sku,
      name: li.product.name,
      quantity: li.quantity,
      unit_price_cents: li.unit_price_cents
    }
  end

  def shipment(%Shipment{} = s) do
    %{
      id: s.id,
      carrier: s.carrier,
      tracking_number: s.tracking_number,
      shipped_at: s.shipped_at,
      delivered_at: s.delivered_at
    }
  end

  def event(%OrderEvent{} = e) do
    base = %{
      id: e.id,
      sequence: e.sequence,
      type: e.type,
      order_id: e.order_id,
      payload: e.payload,
      inserted_at: e.inserted_at
    }

    case e.order do
      %Order{} = o -> Map.put(base, :order_number, o.number)
      _ -> Map.put(base, :order_number, e.payload["number"])
    end
  end
end
