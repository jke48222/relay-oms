defmodule RelayWeb.DashboardChannel do
  @moduledoc """
  Pushes the live order stream to the React dashboard.

  Each channel process subscribes to the same PubSub topic the fulfillment
  pipeline consumes — the browser is just one more consumer of the event
  stream. Events push immediately; metric snapshots are coalesced to at most
  one per #{300}ms window, so a burst of fifty events costs one round of
  aggregate queries instead of fifty (per connected client).
  """

  use Phoenix.Channel

  alias Relay.{Events, Metrics}
  alias RelayWeb.API.JSON, as: Serialize

  @metrics_debounce_ms 300

  @impl true
  def join("dashboard:lobby", _payload, socket) do
    Events.subscribe()
    {:ok, %{metrics: Metrics.summary()}, assign(socket, :metrics_scheduled, false)}
  end

  @impl true
  def handle_info({:order_event, event}, socket) do
    push(socket, "order_event", Serialize.event(event))

    socket =
      if socket.assigns.metrics_scheduled do
        socket
      else
        Process.send_after(self(), :push_metrics, @metrics_debounce_ms)
        assign(socket, :metrics_scheduled, true)
      end

    {:noreply, socket}
  end

  def handle_info(:push_metrics, socket) do
    push(socket, "metrics", %{data: Metrics.summary()})
    {:noreply, assign(socket, :metrics_scheduled, false)}
  end
end
