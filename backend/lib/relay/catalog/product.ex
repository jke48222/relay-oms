defmodule Relay.Catalog.Product do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id
  schema "products" do
    field :sku, :string
    field :name, :string
    field :unit_price_cents, :integer

    timestamps(type: :utc_datetime_usec)
  end

  def changeset(product, attrs) do
    product
    |> cast(attrs, [:sku, :name, :unit_price_cents])
    |> validate_required([:sku, :name, :unit_price_cents])
    |> validate_number(:unit_price_cents, greater_than_or_equal_to: 0)
    |> unique_constraint(:sku)
  end
end
