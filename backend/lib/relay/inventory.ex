defmodule Relay.Inventory do
  @moduledoc """
  Facilities and the stock they hold.

  Allocation (promising units to an order) lives here too — it is the one
  place Relay touches inventory counts, and it always runs inside a
  transaction with row locks. See `allocate_order/1`.
  """

  import Ecto.Query, warn: false

  alias Relay.Inventory.{Facility, InventoryItem}
  alias Relay.Repo

  ## Facilities

  def list_facilities do
    Repo.all(from f in Facility, order_by: f.code)
  end

  def get_facility!(id), do: Repo.get!(Facility, id)

  def create_facility(attrs) do
    %Facility{}
    |> Facility.changeset(attrs)
    |> Repo.insert()
  end

  ## Stock

  def list_inventory do
    Repo.all(
      from i in InventoryItem,
        join: f in assoc(i, :facility),
        join: p in assoc(i, :product),
        preload: [facility: f, product: p],
        order_by: [f.code, p.sku]
    )
  end

  def upsert_inventory_item(attrs) do
    %InventoryItem{}
    |> InventoryItem.changeset(attrs)
    |> Repo.insert(
      on_conflict: {:replace, [:on_hand, :allocated, :updated_at]},
      conflict_target: [:facility_id, :product_id]
    )
  end

  ## Allocation — call these ONLY inside a transaction.
  #
  # All rows for the order's products are locked with FOR UPDATE before any
  # counts are read, so two orders racing for the last units serialize at the
  # database: the first wins, the second sees the decremented stock and gets
  # {:error, :insufficient_stock}. The DB check constraint
  # (allocated <= on_hand) is the final backstop.

  alias Relay.Fulfillment.Zones

  @doc """
  Reserve stock for `line_items` at a single facility that can cover all of
  them, preferring the facility in the destination's shipping zone, then the
  one with the deepest availability. Returns `{:ok, facility_id}` or
  `{:error, :insufficient_stock}`.
  """
  def allocate_within_txn(line_items, destination_region) do
    needs = aggregate_needs(line_items)
    rows = lock_rows(Map.keys(needs))
    facilities_by_id = Map.new(list_facilities(), &{&1.id, &1})
    dest_zone = Zones.zone_for(destination_region)

    candidate =
      rows
      |> Enum.group_by(& &1.facility_id)
      |> Enum.filter(fn {_fid, frows} -> covers?(frows, needs) end)
      |> Enum.sort_by(fn {fid, frows} ->
        facility = facilities_by_id[fid]
        zone_match = if Zones.zone_for(facility.region) == dest_zone, do: 0, else: 1
        {zone_match, -total_available(frows)}
      end)
      |> List.first()

    case candidate do
      nil ->
        {:error, :insufficient_stock}

      {facility_id, frows} ->
        adjust_rows(frows, needs, allocated: 1)
        {:ok, facility_id}
    end
  end

  @doc "Return an order's reserved units to the pool (cancellation)."
  def release_within_txn(line_items, facility_id) do
    needs = aggregate_needs(line_items)
    rows = lock_rows(Map.keys(needs), facility_id)
    adjust_rows(rows, needs, allocated: -1)
    :ok
  end

  @doc "Ship reserved units out the door: on_hand and allocated both drop."
  def consume_within_txn(line_items, facility_id) do
    needs = aggregate_needs(line_items)
    rows = lock_rows(Map.keys(needs), facility_id)
    adjust_rows(rows, needs, on_hand: -1, allocated: -1)
    :ok
  end

  defp aggregate_needs(line_items) do
    Enum.reduce(line_items, %{}, fn li, acc ->
      Map.update(acc, li.product_id, li.quantity, &(&1 + li.quantity))
    end)
  end

  defp lock_rows(product_ids, facility_id \\ nil) do
    query =
      from i in InventoryItem,
        where: i.product_id in ^product_ids,
        lock: "FOR UPDATE"

    query = if facility_id, do: where(query, [i], i.facility_id == ^facility_id), else: query
    Repo.all(query)
  end

  defp covers?(rows, needs) do
    by_product = Map.new(rows, &{&1.product_id, &1})

    Enum.all?(needs, fn {product_id, qty} ->
      case by_product[product_id] do
        nil -> false
        item -> InventoryItem.available(item) >= qty
      end
    end)
  end

  defp total_available(rows), do: rows |> Enum.map(&InventoryItem.available/1) |> Enum.sum()

  defp adjust_rows(rows, needs, signs) do
    by_product = Map.new(rows, &{&1.product_id, &1})

    Enum.each(needs, fn {product_id, qty} ->
      row = Map.fetch!(by_product, product_id)

      inc =
        for {field, sign} <- signs, do: {field, sign * qty}

      {1, _} = Repo.update_all(from(i in InventoryItem, where: i.id == ^row.id), inc: inc)
    end)
  end

  @doc """
  Receive inbound stock: `quantity` new units of a product arrive at a
  facility. The one way `on_hand` ever increases.
  """
  def receive_stock(facility_id, product_id, quantity)
      when is_integer(quantity) and quantity > 0 do
    with {:ok, facility_uuid} <- Ecto.UUID.cast(facility_id),
         {:ok, product_uuid} <- Ecto.UUID.cast(product_id) do
      query =
        from i in InventoryItem,
          where: i.facility_id == ^facility_uuid and i.product_id == ^product_uuid

      case Repo.update_all(query, inc: [on_hand: quantity]) do
        {1, _} ->
          item =
            Repo.get_by!(InventoryItem, facility_id: facility_uuid, product_id: product_uuid)
            |> Repo.preload([:facility, :product])

          {:ok, item}

        {0, _} ->
          {:error, :not_found}
      end
    else
      :error -> {:error, :not_found}
    end
  end

  def receive_stock(_facility_id, _product_id, _quantity), do: {:error, :invalid_quantity}

  @doc """
  Per-facility rollup for the dashboard: total units on hand, allocated,
  and available.
  """
  def snapshot do
    Repo.all(
      from i in InventoryItem,
        join: f in assoc(i, :facility),
        group_by: [f.id, f.code, f.name, f.city, f.region],
        select: %{
          facility_id: f.id,
          code: f.code,
          name: f.name,
          city: f.city,
          region: f.region,
          on_hand: sum(i.on_hand),
          allocated: sum(i.allocated),
          available: sum(i.on_hand - i.allocated)
        },
        order_by: f.code
    )
  end
end
