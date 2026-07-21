defmodule Relay.Metrics do
  @moduledoc """
  Operational rollups for the dashboard, computed straight from Postgres.

  Rate metrics (fill rate) read the immutable event log rather than current
  order status — a cancelled order can't retroactively change how allocation
  went, so the rates don't drift as statuses move on.
  """

  import Ecto.Query, warn: false

  alias Relay.Events.OrderEvent
  alias Relay.Fulfillment.Shipment
  alias Relay.Orders
  alias Relay.Orders.Order
  alias Relay.Repo

  def summary do
    today = DateTime.new!(Date.utc_today(), ~T[00:00:00], "Etc/UTC")

    %{
      orders_today: count_since(today),
      gmv_today_cents: gmv_since(today),
      open_orders: open_orders(),
      exceptions: count_status("exception"),
      fill_rate_percent: fill_rate(),
      avg_time_to_ship_seconds: avg_time_to_ship(),
      status_counts: Orders.status_counts()
    }
  end

  defp count_since(cutoff) do
    Repo.aggregate(from(o in Order, where: o.placed_at >= ^cutoff), :count)
  end

  defp gmv_since(cutoff) do
    Repo.one(
      from o in Order,
        where: o.placed_at >= ^cutoff and o.status not in ["cancelled", "exception"],
        select: coalesce(sum(o.total_cents), 0)
    )
  end

  defp open_orders do
    Repo.aggregate(
      from(o in Order, where: o.status not in ["delivered", "cancelled"]),
      :count
    )
  end

  defp count_status(status) do
    Repo.aggregate(from(o in Order, where: o.status == ^status), :count)
  end

  # Share of allocation ATTEMPTS that found stock, read from the event log.
  # Statuses move on (exceptions get retried or cancelled); the events that
  # recorded each attempt never do.
  defp fill_rate do
    %{hits: hits, misses: misses} =
      Repo.one(
        from e in OrderEvent,
          where: e.type in ["order.allocated", "order.allocation_failed"],
          select: %{
            hits: count(e.id) |> filter(e.type == "order.allocated"),
            misses: count(e.id) |> filter(e.type == "order.allocation_failed")
          }
      )

    case hits + misses do
      0 -> nil
      attempted -> Float.round(hits / attempted * 100, 1)
    end
  end

  defp avg_time_to_ship do
    Repo.one(
      from s in Shipment,
        join: o in Order,
        on: o.id == s.order_id,
        select: avg(fragment("EXTRACT(EPOCH FROM (? - ?))", s.shipped_at, o.placed_at))
    )
    |> case do
      nil -> nil
      %Decimal{} = avg -> avg |> Decimal.round(1) |> Decimal.to_float()
      avg when is_float(avg) -> Float.round(avg, 1)
    end
  end
end
