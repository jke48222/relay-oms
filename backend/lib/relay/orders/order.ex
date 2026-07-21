defmodule Relay.Orders.Order do
  use Ecto.Schema
  import Ecto.Changeset

  alias Relay.Events.OrderEvent
  alias Relay.Fulfillment.Shipment
  alias Relay.Inventory.Facility
  alias Relay.Orders.LineItem

  @statuses ~w(received allocated picking packed shipped delivered exception cancelled)
  @channels ~w(shopify amazon tiktok_shop b2b dtc)

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id
  schema "orders" do
    field :number, :string
    field :status, :string, default: "received"
    field :channel, :string
    field :customer_name, :string
    field :destination_city, :string
    field :destination_region, :string
    field :total_cents, :integer, default: 0
    field :idempotency_key, :string
    field :placed_at, :utc_datetime_usec

    belongs_to :facility, Facility
    has_many :line_items, LineItem
    has_many :events, OrderEvent, preload_order: [asc: :sequence]
    has_one :shipment, Shipment

    timestamps(type: :utc_datetime_usec)
  end

  def statuses, do: @statuses
  def channels, do: @channels

  def changeset(order, attrs) do
    order
    |> cast(attrs, [
      :number,
      :status,
      :channel,
      :customer_name,
      :destination_city,
      :destination_region,
      :total_cents,
      :idempotency_key,
      :placed_at
    ])
    |> validate_required([
      :number,
      :status,
      :channel,
      :customer_name,
      :destination_city,
      :destination_region,
      :placed_at
    ])
    |> validate_inclusion(:status, @statuses)
    |> validate_inclusion(:channel, @channels)
    |> unique_constraint(:number)
    |> unique_constraint(:idempotency_key)
  end
end
