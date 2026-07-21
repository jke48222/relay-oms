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

  ## Crash safety

  Timers are process-local, so a restart would strand every in-flight order
  (and permanently hold its reserved stock). To recover, `init/1` rehydrates:
  it scans the database for non-terminal orders and reschedules each one's
  next step — the same reason a Kafka consumer tracks offsets and resumes
  from the log on boot. Rehydration is safe to race with live events because
  every transition validates against the state machine under a row lock; a
  duplicate advance simply loses with `{:invalid_transition, ...}`.

  A step that finds the order already moved (say, cancelled while the
  picking timer was in flight) is likewise dropped — the state machine, not
  the timer, is the authority.
  """

  use GenServer

  require Logger

  alias Relay.Events
  alias Relay.Events.OrderEvent
  alias Relay.Orders
  alias Relay.Orders.Workflow

  @next_step %{
    "order.received" => :allocate,
    "order.allocated" => :start_picking,
    "order.picking" => :mark_packed,
    "order.packed" => :ship,
    "order.shipped" => :mark_delivered
  }

  # On boot there is no event to react to — only the order's current status.
  @step_for_status %{
    "received" => :allocate,
    "allocated" => :start_picking,
    "picking" => :mark_packed,
    "packed" => :ship,
    "shipped" => :mark_delivered
  }

  def start_link(opts) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @impl true
  def init(_opts) do
    Events.subscribe()
    {:ok, %{}, {:continue, :rehydrate}}
  end

  @impl true
  def handle_continue(:rehydrate, state) do
    in_flight = Orders.list_in_flight()

    Enum.each(in_flight, fn order ->
      case @step_for_status[order.status] do
        nil -> :ok
        step -> schedule(step, order.id)
      end
    end)

    if in_flight != [] do
      Logger.info("pipeline: rehydrated #{length(in_flight)} in-flight order(s)")
    end

    {:noreply, state}
  end

  @impl true
  def handle_info({:order_event, %OrderEvent{} = event}, state) do
    case @next_step[event.type] do
      nil -> :ok
      step -> schedule(step, event.order_id)
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

  # A supervised worker must shrug off messages it didn't ask for — crashing
  # here would discard every pending timer.
  def handle_info(message, state) do
    Logger.debug("pipeline: ignoring unexpected message #{inspect(message)}")
    {:noreply, state}
  end

  defp schedule(step, order_id) do
    Process.send_after(self(), {:advance, step, order_id}, delay_for(step))
  end

  defp delay_for(step) do
    delays = Application.get_env(:relay, __MODULE__)[:step_delays_ms] || []
    base = Keyword.get(delays, step, 1_000)
    base + :rand.uniform(max(div(base, 2), 1))
  end
end
