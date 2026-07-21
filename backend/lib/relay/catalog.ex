defmodule Relay.Catalog do
  @moduledoc """
  Products and SKUs — what brands sell through Relay.
  """

  import Ecto.Query, warn: false

  alias Relay.Catalog.Product
  alias Relay.Repo

  def list_products do
    Repo.all(from p in Product, order_by: p.sku)
  end

  def get_product!(id), do: Repo.get!(Product, id)

  def get_product_by_sku(sku), do: Repo.get_by(Product, sku: sku)

  def create_product(attrs) do
    %Product{}
    |> Product.changeset(attrs)
    |> Repo.insert()
  end
end
