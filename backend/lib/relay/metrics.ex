defmodule Relay.Metrics do
  @moduledoc """
  Operational rollups for the dashboard. Every figure is computed straight
  from Postgres — the event log and the orders table are the source of
  truth, so the numbers can't drift from reality.
  """

  import Ecto.Query, warn: false

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
        where: o.placed_at >= ^cutoff and o.status != "cancelled",
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

  # Of the orders allocation has ruled on, how many got stock? Exceptions are
  # the misses; anything holding a facility is a hit.
  defp fill_rate do
    %{hits: hits, misses: misses} =
      Repo.one(
        from o in Order,
          select: %{
            hits: count(o.id) |> filter(not is_nil(o.facility_id)),
            misses: count(o.id) |> filter(o.status == "exception")
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
