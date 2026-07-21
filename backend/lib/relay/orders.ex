defmodule Relay.Orders do
  @moduledoc """
  Orders and their lifecycle. Read side lives here; writes that move an order
  through the pipeline (create → allocate → … → delivered) are defined
  alongside the event machinery so every state change and its event commit
  atomically. See `Relay.Orders.Workflow` (added with the event pipeline).
  """

  import Ecto.Query, warn: false

  alias Relay.Orders.Order
  alias Relay.Repo

  @default_page_size 25
  @max_page_size 100

  def get_order!(id) do
    Order
    |> Repo.get!(id)
    |> Repo.preload([:facility, :shipment, :events, line_items: [:product]])
  end

  @doc "Controller-safe fetch: bad UUIDs and misses both come back as errors."
  def fetch_order(id) do
    case Ecto.UUID.cast(id) do
      {:ok, uuid} ->
        case Repo.get(Order, uuid) do
          nil ->
            {:error, :not_found}

          order ->
            {:ok, Repo.preload(order, [:facility, :shipment, :events, line_items: [:product]])}
        end

      :error ->
        {:error, :not_found}
    end
  end

  def get_order_by_idempotency_key(key) when is_binary(key) do
    Repo.get_by(Order, idempotency_key: key)
  end

  @doc """
  Paginated, filterable listing.

  Options: `:status`, `:channel`, `:page` (1-based), `:page_size`.
  Returns `%{orders: [...], page: n, page_size: n, total: n}`.
  """
  def list_orders(opts \\ %{}) do
    page = to_positive_int(opts[:page] || opts["page"], 1)

    page_size =
      min(
        to_positive_int(opts[:page_size] || opts["page_size"], @default_page_size),
        @max_page_size
      )

    base =
      Order
      |> filter_by(:status, opts[:status] || opts["status"])
      |> filter_by(:channel, opts[:channel] || opts["channel"])

    total = Repo.aggregate(base, :count)

    orders =
      base
      |> order_by([o], desc: o.placed_at)
      |> limit(^page_size)
      |> offset(^((page - 1) * page_size))
      |> preload([:facility, :shipment, line_items: [:product]])
      |> Repo.all()

    %{orders: orders, page: page, page_size: page_size, total: total}
  end

  @doc "Counts by status — feeds the dashboard funnel."
  def status_counts do
    counts =
      Repo.all(from o in Order, group_by: o.status, select: {o.status, count(o.id)})
      |> Map.new()

    Map.new(Order.statuses(), fn status -> {status, Map.get(counts, status, 0)} end)
  end

  defp filter_by(query, _field, nil), do: query
  defp filter_by(query, _field, ""), do: query
  defp filter_by(query, field, value), do: where(query, [o], field(o, ^field) == ^value)

  defp to_positive_int(nil, default), do: default

  defp to_positive_int(value, default) when is_binary(value) do
    case Integer.parse(value) do
      {n, ""} when n > 0 -> n
      _ -> default
    end
  end

  defp to_positive_int(value, _default) when is_integer(value) and value > 0, do: value
  defp to_positive_int(_, default), do: default
end
