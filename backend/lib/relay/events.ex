defmodule Relay.Events do
  @moduledoc """
  The append-only event log (transactional outbox) and its PubSub fan-out.

  Every state change in Relay writes an `OrderEvent` row in the same database
  transaction as the change itself, then broadcasts it after commit. In
  production at Stord scale the broadcast side would be a Kafka producer
  driven off this table (outbox pattern); here `Phoenix.PubSub` plays that
  role in-process.
  """

  import Ecto.Query, warn: false

  alias Relay.Events.OrderEvent
  alias Relay.Repo

  @pubsub Relay.PubSub
  @topic "order_events"

  def topic, do: @topic

  @doc "Subscribe the calling process to the event stream."
  def subscribe, do: Phoenix.PubSub.subscribe(@pubsub, @topic)

  @doc """
  Build an event changeset for insertion inside a caller's `Ecto.Multi`.
  """
  def build(order_id, type, payload \\ %{}) do
    OrderEvent.changeset(%OrderEvent{}, %{order_id: order_id, type: type, payload: payload})
  end

  @doc """
  Broadcast a committed event to subscribers. Call this only after the
  enclosing transaction has committed — never from inside it.
  """
  def broadcast(%OrderEvent{} = event) do
    Phoenix.PubSub.broadcast(@pubsub, @topic, {:order_event, event})
    event
  end

  def list_recent(limit \\ 50) do
    Repo.all(
      from e in OrderEvent,
        order_by: [desc: e.sequence],
        limit: ^limit,
        preload: [order: :facility]
    )
  end
end
