defmodule Relay.Inventory.InventoryItem do
  use Ecto.Schema
  import Ecto.Changeset

  alias Relay.Catalog.Product
  alias Relay.Inventory.Facility

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id
  schema "inventory_items" do
    field :on_hand, :integer, default: 0
    field :allocated, :integer, default: 0

    belongs_to :facility, Facility
    belongs_to :product, Product

    timestamps(type: :utc_datetime_usec)
  end

  @doc "Units free to promise to new orders."
  def available(%__MODULE__{on_hand: on_hand, allocated: allocated}), do: on_hand - allocated

  def changeset(item, attrs) do
    item
    |> cast(attrs, [:facility_id, :product_id, :on_hand, :allocated])
    |> validate_required([:facility_id, :product_id, :on_hand, :allocated])
    |> validate_number(:on_hand, greater_than_or_equal_to: 0)
    |> validate_number(:allocated, greater_than_or_equal_to: 0)
    |> unique_constraint([:facility_id, :product_id])
    |> check_constraint(:allocated, name: :allocated_within_on_hand)
  end
end
