defmodule RelayWeb.DashboardChannelTest do
  # async: false — the channel subscribes to the shared PubSub topic; events
  # from parallel tests would be pushed to this socket too.
  use RelayWeb.ChannelCase, async: false

  import Relay.Fixtures

  alias Relay.Orders.Workflow
  alias RelayWeb.{DashboardChannel, UserSocket}

  setup do
    {:ok, reply, socket} =
      UserSocket
      |> socket("test", %{})
      |> subscribe_and_join(DashboardChannel, "dashboard:lobby")

    %{socket: socket, join_reply: reply}
  end

  test "join returns a metrics snapshot", %{join_reply: reply} do
    assert %{metrics: %{orders_today: _, status_counts: _}} = reply
  end

  test "a workflow action reaches the browser as order_event + debounced metrics",
       %{socket: _socket} do
    product = product_fixture()
    {:ok, order, :created} = Workflow.create_order(order_attrs(product, 1))

    number = order.number
    assert_push "order_event", %{type: "order.received", order_number: ^number}
    # Metrics coalesce into one push per debounce window — and carry real data.
    assert_push "metrics", %{data: %{orders_today: 1}}, 1_000
  end
end
