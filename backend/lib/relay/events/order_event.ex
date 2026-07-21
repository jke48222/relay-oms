defmodule Relay.Events.OrderEvent do
  use Ecto.Schema
  import Ecto.Changeset

  alias Relay.Orders.Order

  @types ~w(
    order.received
    order.allocated
    order.allocation_failed
    order.picking
    order.packed
    order.shipped
    order.delivered
    order.cancelled
  )

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id
  schema "order_events" do
    # Filled by Postgres (bigserial) — the stream's total order, akin to a
    # Kafka partition offset.
    field :sequence, :integer, read_after_writes: true
    field :type, :string
    field :payload, :map, default: %{}

    belongs_to :order, Order

    timestamps(type: :utc_datetime_usec, updated_at: false)
  end

  def types, do: @types

  def changeset(event, attrs) do
    event
    |> cast(attrs, [:order_id, :type, :payload])
    |> validate_required([:order_id, :type])
    |> validate_inclusion(:type, @types)
  end
end
