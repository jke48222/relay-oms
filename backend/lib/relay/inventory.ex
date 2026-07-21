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
