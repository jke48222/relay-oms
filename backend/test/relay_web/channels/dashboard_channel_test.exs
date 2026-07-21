defmodule RelayWeb.DashboardChannelTest do
  use RelayWeb.ChannelCase, async: true

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

  test "a workflow action reaches the browser as order_event + metrics", %{socket: _socket} do
    product = product_fixture()
    {:ok, order, :created} = Workflow.create_order(order_attrs(product, 1))

    number = order.number
    assert_push "order_event", %{type: "order.received", order_number: ^number}
    assert_push "metrics", %{data: %{}}
  end
end
