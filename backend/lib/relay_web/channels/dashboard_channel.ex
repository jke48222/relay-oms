defmodule RelayWeb.DashboardChannel do
  @moduledoc """
  Pushes the live order stream to the React dashboard.

  Each channel process subscribes to the same PubSub topic the fulfillment
  pipeline consumes — the browser is just one more consumer of the event
  stream. Every event is pushed as `order_event`, chased by a fresh
  `metrics` snapshot so the KPI tiles move in the same frame the feed does.
  """

  use Phoenix.Channel

  alias Relay.{Events, Metrics}
  alias RelayWeb.API.JSON, as: Serialize

  @impl true
  def join("dashboard:lobby", _payload, socket) do
    Events.subscribe()
    {:ok, %{metrics: Metrics.summary()}, socket}
  end

  @impl true
  def handle_info({:order_event, event}, socket) do
    push(socket, "order_event", Serialize.event(event))
    push(socket, "metrics", %{data: Metrics.summary()})
    {:noreply, socket}
  end
end
