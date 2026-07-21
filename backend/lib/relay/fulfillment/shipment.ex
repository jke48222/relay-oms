defmodule Relay.Fulfillment.Shipment do
  use Ecto.Schema
  import Ecto.Changeset

  alias Relay.Orders.Order

  @carriers ~w(UPS FedEx USPS OnTrac)

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id
  schema "shipments" do
    field :carrier, :string
    field :tracking_number, :string
    field :shipped_at, :utc_datetime_usec
    field :delivered_at, :utc_datetime_usec

    belongs_to :order, Order

    timestamps(type: :utc_datetime_usec)
  end

  def carriers, do: @carriers

  def changeset(shipment, attrs) do
    shipment
    |> cast(attrs, [:order_id, :carrier, :tracking_number, :shipped_at, :delivered_at])
    |> validate_required([:order_id, :carrier, :tracking_number, :shipped_at])
    |> unique_constraint(:tracking_number)
  end
end
