defmodule RelayWeb.API.CatalogController do
  @moduledoc """
  Read endpoints for the catalog and the stock it lives in, plus inbound
  stock receiving.
  """

  use RelayWeb, :controller

  alias Relay.{Catalog, Inventory}
  alias RelayWeb.API.JSON, as: Serialize

  action_fallback RelayWeb.API.FallbackController

  def products(conn, _params) do
    json(conn, %{data: Enum.map(Catalog.list_products(), &Serialize.product/1)})
  end

  def facilities(conn, _params) do
    json(conn, %{data: Enum.map(Inventory.list_facilities(), &Serialize.facility/1)})
  end

  def inventory(conn, _params) do
    json(conn, %{
      data: Enum.map(Inventory.list_inventory(), &Serialize.inventory_item/1),
      snapshot: Inventory.snapshot()
    })
  end

  def receive_stock(conn, %{
        "facility_id" => facility_id,
        "product_id" => product_id,
        "quantity" => quantity
      }) do
    with {:ok, item} <- Inventory.receive_stock(facility_id, product_id, parse_qty(quantity)) do
      json(conn, %{data: Serialize.inventory_item(item)})
    end
  end

  def receive_stock(_conn, _params), do: {:error, :invalid_quantity}

  defp parse_qty(qty) when is_integer(qty), do: qty

  defp parse_qty(qty) when is_binary(qty) do
    case Integer.parse(qty) do
      {n, ""} -> n
      _ -> 0
    end
  end

  defp parse_qty(_), do: 0
end
