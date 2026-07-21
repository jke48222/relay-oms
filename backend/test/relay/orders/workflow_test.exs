defmodule Relay.Orders.WorkflowTest do
  # async: false — several tests subscribe to the shared PubSub topic and
  # assert_receive; parallel test processes would hear each other's events.
  use Relay.DataCase, async: false

  import Relay.Fixtures

  alias Relay.Events
  alias Relay.Events.OrderEvent
  alias Relay.Inventory.InventoryItem
  alias Relay.Orders.{StateMachine, Workflow}

  defp fresh_stock(facility, product) do
    Repo.get_by!(InventoryItem, facility_id: facility.id, product_id: product.id)
  end

  defp run_to_status(order_id, target) do
    {:ok, order} = Workflow.allocate_order(order_id)
    if target == "allocated", do: order, else: continue_run(order_id, target)
  end

  defp continue_run(order_id, target) do
    {:ok, order} = Workflow.start_picking(order_id)

    if target == "picking" do
      order
    else
      {:ok, order} = Workflow.mark_packed(order_id)

      if target == "packed" do
        order
      else
        {:ok, shipped} = Workflow.ship_order(order_id)
        shipped
      end
    end
  end

  describe "create_order/1" do
    test "creates a received order, snapshots prices, and emits order.received" do
      Events.subscribe()
      product = product_fixture(unit_price_cents: 2_500)

      assert {:ok, order, :created} = Workflow.create_order(order_attrs(product, 3))

      assert order.status == "received"
      assert order.total_cents == 7_500
      assert [line] = order.line_items
      assert line.unit_price_cents == 2_500
      assert [%OrderEvent{type: "order.received"}] = order.events

      assert_receive {:order_event, %OrderEvent{type: "order.received"}}
    end

    test "replays instead of duplicating when the same idempotency key retries" do
      product = product_fixture()
      attrs = order_attrs(product, 1, %{idempotency_key: "checkout-abc123"})

      assert {:ok, first, :created} = Workflow.create_order(attrs)
      assert {:ok, second, :replayed} = Workflow.create_order(attrs)

      assert first.id == second.id
      # The replay must not have appended a second order.received event.
      assert length(second.events) == 1
    end

    test "rejects an order with no line items" do
      assert {:error, :no_line_items} = Workflow.create_order(%{channel: "shopify"})
    end
  end

  describe "allocate_order/1" do
    test "reserves stock at a facility in the destination's zone when it can cover" do
      product = product_fixture()
      east = facility_fixture(region: "GA")
      west = facility_fixture(region: "NV")
      stock_fixture(east, product, 10)
      # West has deeper stock, but the order ships to GA — east should win.
      stock_fixture(west, product, 100)

      {:ok, order, :created} =
        Workflow.create_order(order_attrs(product, 2, %{destination_region: "GA"}))

      assert {:ok, allocated} = Workflow.allocate_order(order.id)

      assert allocated.status == "allocated"
      assert allocated.facility_id == east.id
      assert fresh_stock(east, product).allocated == 2
      assert fresh_stock(west, product).allocated == 0
    end

    test "parks the order in exception when no facility can cover the quantity" do
      Events.subscribe()
      product = product_fixture()
      facility = facility_fixture()
      stock_fixture(facility, product, 5)

      {:ok, order, :created} = Workflow.create_order(order_attrs(product, 8))
      assert {:ok, failed} = Workflow.allocate_order(order.id)

      assert failed.status == "exception"
      # Inventory must be untouched — no partial reservation.
      assert fresh_stock(facility, product).allocated == 0
      assert_receive {:order_event, %OrderEvent{type: "order.allocation_failed"}}
    end

    test "second order for the last units loses cleanly (no oversell)" do
      product = product_fixture()
      facility = facility_fixture()
      stock_fixture(facility, product, 12)

      {:ok, first, :created} = Workflow.create_order(order_attrs(product, 8))
      {:ok, second, :created} = Workflow.create_order(order_attrs(product, 8))

      assert {:ok, %{status: "allocated"}} = Workflow.allocate_order(first.id)
      assert {:ok, %{status: "exception"}} = Workflow.allocate_order(second.id)

      # 8 allocated of 12 — never 16.
      assert fresh_stock(facility, product).allocated == 8
    end
  end

  describe "lifecycle transitions" do
    test "an order cannot skip states" do
      product = product_fixture()
      {:ok, order, :created} = Workflow.create_order(order_attrs(product, 1))

      assert {:error, {:invalid_transition, "received", "packed"}} =
               Workflow.mark_packed(order.id)

      assert {:error, {:invalid_transition, "received", "shipped"}} =
               Workflow.ship_order(order.id)
    end

    test "shipping consumes stock and cuts a tracking number" do
      product = product_fixture()
      facility = facility_fixture()
      stock_fixture(facility, product, 10)

      {:ok, order, :created} = Workflow.create_order(order_attrs(product, 4))
      shipped = run_to_status(order.id, "shipped")

      assert shipped.status == "shipped"
      assert shipped.shipment.tracking_number =~ ~r/^1Z\d{12}$/

      stock = fresh_stock(facility, product)
      # Units left the building: both counters drop.
      assert stock.on_hand == 6
      assert stock.allocated == 0
    end

    test "delivery stamps the shipment" do
      product = product_fixture()
      facility = facility_fixture()
      stock_fixture(facility, product, 10)

      {:ok, order, :created} = Workflow.create_order(order_attrs(product, 1))
      run_to_status(order.id, "shipped")

      assert {:ok, delivered} = Workflow.mark_delivered(order.id)
      assert delivered.status == "delivered"
      assert delivered.shipment.delivered_at
    end
  end

  describe "cancel_order/1" do
    test "cancelling an allocated order returns its stock" do
      product = product_fixture()
      facility = facility_fixture()
      stock_fixture(facility, product, 10)

      {:ok, order, :created} = Workflow.create_order(order_attrs(product, 5))
      {:ok, _} = Workflow.allocate_order(order.id)
      assert fresh_stock(facility, product).allocated == 5

      assert {:ok, cancelled} = Workflow.cancel_order(order.id)

      assert cancelled.status == "cancelled"
      assert fresh_stock(facility, product).allocated == 0
    end

    test "a packed order is past the point of no return" do
      product = product_fixture()
      facility = facility_fixture()
      stock_fixture(facility, product, 10)

      {:ok, order, :created} = Workflow.create_order(order_attrs(product, 1))
      run_to_status(order.id, "packed")

      assert {:error, {:invalid_transition, "packed", "cancelled"}} =
               Workflow.cancel_order(order.id)
    end
  end

  describe "state machine" do
    test "declares the happy path and its exits" do
      assert StateMachine.can_transition?("received", "allocated")
      assert StateMachine.can_transition?("received", "exception")
      refute StateMachine.can_transition?("received", "shipped")
      refute StateMachine.can_transition?("delivered", "cancelled")
      assert StateMachine.next_states("delivered") == []
      assert "packed" not in StateMachine.cancellable_states()
    end
  end
end
