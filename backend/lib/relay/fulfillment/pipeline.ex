defmodule Relay.Fulfillment.Pipeline do
  @moduledoc """
  The async fulfillment worker: subscribes to the order event stream and
  advances each order through its lifecycle on realistic delays —

      order.received   → allocate (reserve stock, pick a facility)
      order.allocated  → start picking
      order.picking    → mark packed
      order.packed     → ship (consume stock, cut a tracking number)
      order.shipped    → mark delivered

  This is the in-process stand-in for a Kafka consumer group: it reacts to
  committed events rather than being called by the code that produced them,
  so the producer (the API request) returns immediately and fulfillment
  happens asynchronously. Timers carry a little jitter so a burst of
  simulated orders doesn't march in lockstep.

  A step that finds the order already moved (say, cancelled while the
  picking timer was in flight) fails with `{:invalid_transition, ...}` and
  is simply dropped — the state machine, not the timer, is the authority.
  """

  use GenServer

  require Logger

  alias Relay.Events
  alias Relay.Events.OrderEvent
  alias Relay.Orders.Workflow

  @next_step %{
    "order.received" => :allocate,
    "order.allocated" => :start_picking,
    "order.picking" => :mark_packed,
    "order.packed" => :ship,
    "order.shipped" => :mark_delivered
  }

  def start_link(opts) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @impl true
  def init(_opts) do
    Events.subscribe()
    {:ok, %{}}
  end

  @impl true
  def handle_info({:order_event, %OrderEvent{} = event}, state) do
    case @next_step[event.type] do
      nil ->
        :ok

      step ->
        Process.send_after(self(), {:advance, step, event.order_id}, delay_for(step))
    end

    {:noreply, state}
  end

  def handle_info({:advance, step, order_id}, state) do
    result =
      case step do
        :allocate -> Workflow.allocate_order(order_id)
        :start_picking -> Workflow.start_picking(order_id)
        :mark_packed -> Workflow.mark_packed(order_id)
        :ship -> Workflow.ship_order(order_id)
        :mark_delivered -> Workflow.mark_delivered(order_id)
      end

    case result do
      {:ok, _order} ->
        :ok

      {:error, {:invalid_transition, from, to}} ->
        Logger.debug("pipeline: skipped #{to} for #{order_id} (now #{from})")

      {:error, reason} ->
        Logger.warning("pipeline: #{step} failed for #{order_id}: #{inspect(reason)}")
    end

    {:noreply, state}
  end

  defp delay_for(step) do
    delays = Application.get_env(:relay, __MODULE__)[:step_delays_ms] || []
    base = Keyword.get(delays, step, 1_000)
    base + :rand.uniform(max(div(base, 2), 1))
  end
end
