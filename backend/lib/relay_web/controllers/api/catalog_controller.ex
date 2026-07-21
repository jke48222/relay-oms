defmodule RelayWeb.API.CatalogController do
  use RelayWeb, :controller

  alias Relay.{Catalog, Inventory}
  alias RelayWeb.API.JSON, as: Serialize

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
end
