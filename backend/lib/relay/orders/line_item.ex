defmodule Relay.Orders.LineItem do
  use Ecto.Schema
  import Ecto.Changeset

  alias Relay.Catalog.Product
  alias Relay.Orders.Order

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id
  schema "order_line_items" do
    field :quantity, :integer
    field :unit_price_cents, :integer

    belongs_to :order, Order
    belongs_to :product, Product

    timestamps(type: :utc_datetime_usec)
  end

  def changeset(line_item, attrs) do
    line_item
    |> cast(attrs, [:product_id, :quantity, :unit_price_cents])
    |> validate_required([:product_id, :quantity, :unit_price_cents])
    |> validate_number(:quantity, greater_than: 0)
    |> validate_number(:unit_price_cents, greater_than_or_equal_to: 0)
  end
end
