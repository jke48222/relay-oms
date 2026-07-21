defmodule Relay.Orders.Workflow do
  @moduledoc """
  The write side of an order's life. Every function here follows the same
  contract:

    1. one database transaction moves the order AND appends its event
       (transactional outbox — the event is never written without the state
       change, and vice versa);
    2. the event broadcasts on PubSub only after commit;
    3. status moves are validated against `Relay.Orders.StateMachine` under a
       row lock, so a stale caller (e.g. a pipeline timer firing after a
       cancellation) fails cleanly with `{:error, {:invalid_transition, ...}}`.
  """

  import Ecto.Query, warn: false

  alias Ecto.Multi
  alias Relay.{Catalog, Events, Inventory, Repo}
  alias Relay.Fulfillment.Shipment
  alias Relay.Orders.{LineItem, Order, StateMachine}

  ## Creation

  @doc """
  Create an order in `received` and emit `order.received`.

  Idempotent: pass `idempotency_key` and retries of the same request return
  the original order (`{:ok, order, :replayed}`) instead of double-charging
  the warehouse. New creations return `{:ok, order, :created}`.
  """
  def create_order(attrs) do
    attrs = normalize(attrs)

    case existing_by_key(attrs[:idempotency_key]) do
      %Order{} = order -> {:ok, preload(order), :replayed}
      nil -> insert_order(attrs)
    end
  end

  # Random order numbers can collide (rarely); regenerating is cheaper and
  # kinder than surfacing "number has already been taken" to a customer.
  @number_attempts 3

  defp insert_order(attrs) do
    with {:ok, line_changesets, total_cents} <- build_line_items(attrs[:line_items]) do
      attempt_insert(attrs, line_changesets, total_cents, @number_attempts)
    end
  end

  defp attempt_insert(attrs, line_changesets, total_cents, attempts_left) do
    changeset =
      %Order{}
      |> Order.changeset(%{
        number: generate_number(),
        status: "received",
        channel: attrs[:channel],
        customer_name: attrs[:customer_name],
        destination_city: attrs[:destination_city],
        destination_region: attrs[:destination_region],
        idempotency_key: attrs[:idempotency_key],
        total_cents: total_cents,
        placed_at: DateTime.utc_now()
      })
      |> Ecto.Changeset.put_assoc(:line_items, line_changesets)

    Multi.new()
    |> Multi.insert(:order, changeset)
    |> Multi.insert(:event, fn %{order: order} ->
      Events.build(order.id, "order.received", %{
        "number" => order.number,
        "channel" => order.channel,
        "total_cents" => order.total_cents,
        "destination" => "#{order.destination_city}, #{order.destination_region}"
      })
    end)
    |> Repo.transaction()
    |> case do
      {:ok, %{order: order, event: event}} ->
        Events.broadcast(event)
        {:ok, preload(order), :created}

      {:error, :order, %Ecto.Changeset{errors: errors} = changeset, _} ->
        cond do
          # Lost a race on the idempotency key: someone committed the same
          # request between our lookup and insert. Replay theirs.
          Keyword.has_key?(errors, :idempotency_key) ->
            {:ok, preload(existing_by_key(attrs[:idempotency_key])), :replayed}

          Keyword.has_key?(errors, :number) and attempts_left > 1 ->
            attempt_insert(attrs, line_changesets, total_cents, attempts_left - 1)

          true ->
            {:error, changeset}
        end
    end
  end

  ## Allocation

  @doc """
  Reserve inventory for a `received` order. Success moves it to `allocated`
  at a chosen facility; a stockout moves it to `exception` with an
  `order.allocation_failed` event. Both outcomes commit atomically with
  their inventory effects.
  """
  def allocate_order(order_id) do
    transact_on_order(order_id, fn order ->
      unless StateMachine.can_transition?(order.status, "allocated") do
        Repo.rollback({:invalid_transition, order.status, "allocated"})
      end

      case Inventory.allocate_within_txn(order.line_items, order.destination_region) do
        {:ok, facility_id} ->
          order =
            order
            |> Ecto.Changeset.change(status: "allocated", facility_id: facility_id)
            |> Repo.update!()

          event =
            Repo.insert!(
              Events.build(order.id, "order.allocated", %{
                "number" => order.number,
                "facility_id" => facility_id
              })
            )

          {order, event}

        {:error, :insufficient_stock} ->
          order =
            order
            |> Ecto.Changeset.change(status: "exception")
            |> Repo.update!()

          event =
            Repo.insert!(
              Events.build(order.id, "order.allocation_failed", %{
                "number" => order.number,
                "reason" => "insufficient_stock"
              })
            )

          {order, event}
      end
    end)
  end

  ## Pipeline steps

  def start_picking(order_id), do: simple_transition(order_id, "picking")

  def mark_packed(order_id), do: simple_transition(order_id, "packed")

  @doc """
  Ship a `packed` order: consume its reserved stock (units leave the
  building), create the shipment, emit `order.shipped`.
  """
  def ship_order(order_id) do
    transact_on_order(order_id, fn order ->
      unless StateMachine.can_transition?(order.status, "shipped") do
        Repo.rollback({:invalid_transition, order.status, "shipped"})
      end

      Inventory.consume_within_txn(order.line_items, order.facility_id)

      order = order |> Ecto.Changeset.change(status: "shipped") |> Repo.update!()

      shipment =
        Repo.insert!(
          Shipment.changeset(%Shipment{}, %{
            order_id: order.id,
            carrier: Enum.random(Shipment.carriers()),
            tracking_number: generate_tracking(),
            shipped_at: DateTime.utc_now()
          })
        )

      event =
        Repo.insert!(
          Events.build(order.id, "order.shipped", %{
            "number" => order.number,
            "carrier" => shipment.carrier,
            "tracking_number" => shipment.tracking_number
          })
        )

      {order, event}
    end)
  end

  def mark_delivered(order_id) do
    transact_on_order(order_id, fn order ->
      unless StateMachine.can_transition?(order.status, "delivered") do
        Repo.rollback({:invalid_transition, order.status, "delivered"})
      end

      order = order |> Ecto.Changeset.change(status: "delivered") |> Repo.update!()

      Repo.update_all(from(s in Shipment, where: s.order_id == ^order.id),
        set: [delivered_at: DateTime.utc_now()]
      )

      event = Repo.insert!(Events.build(order.id, "order.delivered", %{"number" => order.number}))
      {order, event}
    end)
  end

  @doc """
  Send an `exception` order back through allocation — the move you make after
  restocking. Emits `order.received` with a retry marker, so the pipeline
  reacts exactly as it would to a fresh order; the state machine guard means
  only parked exceptions can take this path.
  """
  def retry_allocation(order_id) do
    transact_on_order(order_id, fn order ->
      unless StateMachine.can_transition?(order.status, "received") do
        Repo.rollback({:invalid_transition, order.status, "received"})
      end

      order = order |> Ecto.Changeset.change(status: "received") |> Repo.update!()

      event =
        Repo.insert!(
          Events.build(order.id, "order.received", %{
            "number" => order.number,
            "retry" => true
          })
        )

      {order, event}
    end)
  end

  ## Cancellation

  @doc """
  Cancel an order if its state still allows it, returning any reserved stock
  to the pool.
  """
  def cancel_order(order_id) do
    transact_on_order(order_id, fn order ->
      unless StateMachine.can_transition?(order.status, "cancelled") do
        Repo.rollback({:invalid_transition, order.status, "cancelled"})
      end

      if order.facility_id do
        Inventory.release_within_txn(order.line_items, order.facility_id)
      end

      order = order |> Ecto.Changeset.change(status: "cancelled") |> Repo.update!()
      event = Repo.insert!(Events.build(order.id, "order.cancelled", %{"number" => order.number}))
      {order, event}
    end)
  end

  ## Shared plumbing

  # Lock the order row, run `fun`, broadcast the event after commit.
  defp transact_on_order(order_id, fun) do
    Repo.transaction(fn ->
      order =
        from(o in Order, where: o.id == ^order_id, lock: "FOR UPDATE")
        |> Repo.one()

      case order do
        nil -> Repo.rollback(:not_found)
        order -> fun.(Repo.preload(order, :line_items))
      end
    end)
    |> case do
      {:ok, {order, event}} ->
        Events.broadcast(event)
        {:ok, preload(order)}

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp simple_transition(order_id, to) do
    transact_on_order(order_id, fn order ->
      unless StateMachine.can_transition?(order.status, to) do
        Repo.rollback({:invalid_transition, order.status, to})
      end

      order = order |> Ecto.Changeset.change(status: to) |> Repo.update!()
      event = Repo.insert!(Events.build(order.id, "order.#{to}", %{"number" => order.number}))
      {order, event}
    end)
  end

  defp build_line_items(nil), do: {:error, :no_line_items}
  defp build_line_items([]), do: {:error, :no_line_items}

  defp build_line_items(specs) when is_list(specs) do
    products = Map.new(Catalog.list_products(), &{&1.id, &1})

    result =
      Enum.reduce_while(specs, {[], 0}, fn spec, {changesets, total} ->
        case normalize_line(spec) do
          {:error, reason} ->
            {:halt, {:error, reason}}

          spec ->
            build_line_item(products, spec, changesets, total)
        end
      end)

    case result do
      {:error, reason} -> {:error, reason}
      {changesets, total} -> {:ok, Enum.reverse(changesets), total}
    end
  end

  # A JSON object or scalar where a list belongs is a client error, not a crash.
  defp build_line_items(_), do: {:error, :no_line_items}

  defp build_line_item(products, spec, changesets, total) do
    case products[spec[:product_id]] do
      nil ->
        {:halt, {:error, {:unknown_product, spec[:product_id]}}}

      product ->
        quantity = spec[:quantity] || 0

        changeset =
          LineItem.changeset(%LineItem{}, %{
            product_id: product.id,
            quantity: quantity,
            unit_price_cents: product.unit_price_cents
          })

        {:cont, {[changeset | changesets], total + quantity * product.unit_price_cents}}
    end
  end

  defp existing_by_key(nil), do: nil
  defp existing_by_key(key), do: Repo.get_by(Order, idempotency_key: key)

  defp preload(order) do
    Repo.preload(order, [:facility, :shipment, :events, line_items: [:product]], force: true)
  end

  defp generate_number do
    suffix =
      :crypto.strong_rand_bytes(4)
      |> Base.encode32(padding: false)
      |> binary_part(0, 6)

    "RLY-" <> suffix
  end

  defp generate_tracking do
    digits = :crypto.strong_rand_bytes(6) |> :binary.decode_unsigned() |> rem(1_000_000_000_000)
    "1Z" <> String.pad_leading(Integer.to_string(digits), 12, "0")
  end

  # Accept string or atom keys from controllers; unknown keys are ignored
  # rather than atomized (never `String.to_atom/1` on user input).
  @order_keys ~w(channel customer_name destination_city destination_region idempotency_key line_items)a
  @line_keys ~w(product_id quantity)a

  defp normalize(map), do: take_keys(map, @order_keys)

  defp normalize_line(map) when is_map(map), do: take_keys(map, @line_keys)
  # A scalar where a line-item object belongs (e.g. `"line_items": [1, 2]`).
  defp normalize_line(_), do: {:error, :invalid_line_items}

  defp take_keys(map, keys) when is_map(map) do
    Map.new(keys, fn key -> {key, Map.get(map, key) || Map.get(map, Atom.to_string(key))} end)
  end
end
