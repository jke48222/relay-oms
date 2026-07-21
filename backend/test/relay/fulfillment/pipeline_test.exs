defmodule Relay.Fulfillment.PipelineTest do
  # async: false — the pipeline GenServer shares the PubSub topic and the
  # sandbox connection (shared mode) with the test process.
  use Relay.DataCase, async: false

  import Relay.Fixtures

  alias Relay.Events
  alias Relay.Events.OrderEvent
  alias Relay.Fulfillment.Pipeline
  alias Relay.Orders.Workflow

  setup do
    original = Application.get_env(:relay, Pipeline)

    Application.put_env(:relay, Pipeline,
      enabled: false,
      step_delays_ms: [allocate: 5, start_picking: 5, mark_packed: 5, ship: 5, mark_delivered: 5]
    )

    on_exit(fn -> Application.put_env(:relay, Pipeline, original) end)
    :ok
  end

  test "drives a live order all the way to delivered" do
    Events.subscribe()
    product = product_fixture()
    facility = facility_fixture()
    stock_fixture(facility, product, 10)

    start_supervised!(Pipeline)

    {:ok, order, :created} = Workflow.create_order(order_attrs(product, 2))
    order_id = order.id

    assert_receive {:order_event, %OrderEvent{type: "order.delivered", order_id: ^order_id}},
                   2_000
  end

  test "rehydrates in-flight orders on boot instead of stranding them" do
    Events.subscribe()
    product = product_fixture()
    facility = facility_fixture()
    stock_fixture(facility, product, 10)

    # Created while NO pipeline is running: the order.received broadcast goes
    # nowhere, exactly like an order caught mid-flight by a node restart.
    {:ok, order, :created} = Workflow.create_order(order_attrs(product, 1))
    order_id = order.id

    # Boot the worker afterwards — only the init-time DB scan can advance it.
    start_supervised!(Pipeline)

    assert_receive {:order_event, %OrderEvent{type: "order.delivered", order_id: ^order_id}},
                   2_000
  end
end
