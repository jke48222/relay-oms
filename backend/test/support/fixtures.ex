defmodule Relay.Fixtures do
  @moduledoc """
  Minimal builders for domain records. Each returns a persisted struct.
  """

  alias Relay.{Catalog, Inventory}

  # Accept `product_fixture(sku: "X")` and `product_fixture(%{sku: "X"})` alike.
  defp to_map(attrs), do: Map.new(attrs)

  def product_fixture(attrs \\ %{}) do
    defaults = %{
      sku: "SKU-#{System.unique_integer([:positive])}",
      name: "Test Product",
      unit_price_cents: 1_000
    }

    {:ok, product} = Catalog.create_product(Map.merge(defaults, to_map(attrs)))
    product
  end

  def facility_fixture(attrs \\ %{}) do
    defaults = %{
      code: "FAC-#{System.unique_integer([:positive])}",
      name: "Test Fulfillment Center",
      city: "Union City",
      region: "GA"
    }

    {:ok, facility} = Inventory.create_facility(Map.merge(defaults, to_map(attrs)))
    facility
  end

  def stock_fixture(facility, product, on_hand, allocated \\ 0) do
    {:ok, item} =
      Inventory.upsert_inventory_item(%{
        facility_id: facility.id,
        product_id: product.id,
        on_hand: on_hand,
        allocated: allocated
      })

    item
  end

  def order_attrs(product, quantity, overrides \\ %{}) do
    Map.merge(
      %{
        channel: "shopify",
        customer_name: "Test Customer",
        destination_city: "Atlanta",
        destination_region: "GA",
        line_items: [%{product_id: product.id, quantity: quantity}]
      },
      overrides
    )
  end
end
