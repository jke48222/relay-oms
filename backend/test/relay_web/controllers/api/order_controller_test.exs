defmodule RelayWeb.API.OrderControllerTest do
  use RelayWeb.ConnCase, async: true

  import Relay.Fixtures

  describe "POST /api/v1/orders" do
    test "creates an order and returns 201", %{conn: conn} do
      product = product_fixture(unit_price_cents: 2_000)

      conn =
        post(conn, ~p"/api/v1/orders", %{
          "channel" => "shopify",
          "customer_name" => "Ada Lovelace",
          "destination_city" => "Atlanta",
          "destination_region" => "GA",
          "line_items" => [%{"product_id" => product.id, "quantity" => 2}]
        })

      assert %{"data" => data, "meta" => %{"idempotent_replay" => false}} =
               json_response(conn, 201)

      assert data["status"] == "received"
      assert data["total_cents"] == 4_000
      assert data["number"] =~ ~r/^RLY-/
    end

    test "replays on a repeated Idempotency-Key with 200, not 201", %{conn: conn} do
      product = product_fixture()
      body = order_attrs(product, 1) |> Jason.encode!() |> Jason.decode!()

      first =
        conn
        |> put_req_header("idempotency-key", "req-777")
        |> post(~p"/api/v1/orders", body)

      assert %{"data" => %{"id" => id}} = json_response(first, 201)

      replay =
        build_conn()
        |> put_req_header("idempotency-key", "req-777")
        |> post(~p"/api/v1/orders", body)

      assert %{"data" => %{"id" => ^id}, "meta" => %{"idempotent_replay" => true}} =
               json_response(replay, 200)
    end

    test "422s a body with no line items", %{conn: conn} do
      conn = post(conn, ~p"/api/v1/orders", %{"channel" => "shopify"})
      assert %{"error" => %{"code" => "no_line_items"}} = json_response(conn, 422)
    end

    test "422s a JSON object where the line_items list belongs", %{conn: conn} do
      conn =
        post(conn, ~p"/api/v1/orders", %{"channel" => "shopify", "line_items" => %{"oops" => 1}})

      assert %{"error" => %{"code" => "no_line_items"}} = json_response(conn, 422)
    end

    test "422s scalar line items instead of crashing", %{conn: conn} do
      conn =
        post(conn, ~p"/api/v1/orders", %{"channel" => "shopify", "line_items" => [1, 2]})

      assert %{"error" => %{"code" => "invalid_line_items"}} = json_response(conn, 422)
    end

    test "422s an unknown product", %{conn: conn} do
      conn =
        post(conn, ~p"/api/v1/orders", %{
          "channel" => "shopify",
          "customer_name" => "X",
          "destination_city" => "Y",
          "destination_region" => "GA",
          "line_items" => [%{"product_id" => Ecto.UUID.generate(), "quantity" => 1}]
        })

      assert %{"error" => %{"code" => "unknown_product"}} = json_response(conn, 422)
    end
  end

  describe "GET /api/v1/orders" do
    test "paginates and filters by status", %{conn: conn} do
      product = product_fixture()

      for _ <- 1..3 do
        {:ok, _, :created} = Relay.Orders.Workflow.create_order(order_attrs(product, 1))
      end

      conn = get(conn, ~p"/api/v1/orders?status=received&page_size=2")
      assert %{"data" => data, "meta" => meta} = json_response(conn, 200)
      assert length(data) == 2
      assert meta["total"] == 3
      assert Enum.all?(data, &(&1["status"] == "received"))
    end
  end

  describe "GET /api/v1/orders/:id" do
    test "returns the order with its event timeline", %{conn: conn} do
      product = product_fixture()
      {:ok, order, :created} = Relay.Orders.Workflow.create_order(order_attrs(product, 1))

      conn = get(conn, ~p"/api/v1/orders/#{order.id}")
      assert %{"data" => data} = json_response(conn, 200)
      assert [%{"type" => "order.received"}] = data["events"]
    end

    test "404s a malformed id instead of crashing", %{conn: conn} do
      conn = get(conn, ~p"/api/v1/orders/not-a-uuid")
      assert %{"error" => %{"code" => "not_found"}} = json_response(conn, 404)
    end
  end

  describe "POST /api/v1/orders/:id/cancel" do
    test "cancels a received order", %{conn: conn} do
      product = product_fixture()
      {:ok, order, :created} = Relay.Orders.Workflow.create_order(order_attrs(product, 1))

      conn = post(conn, ~p"/api/v1/orders/#{order.id}/cancel")
      assert %{"data" => %{"status" => "cancelled"}} = json_response(conn, 200)
    end

    test "409s a cancel that the state machine forbids", %{conn: conn} do
      product = product_fixture()
      facility = facility_fixture()
      stock_fixture(facility, product, 10)

      {:ok, order, :created} = Relay.Orders.Workflow.create_order(order_attrs(product, 1))
      {:ok, _} = Relay.Orders.Workflow.allocate_order(order.id)
      {:ok, _} = Relay.Orders.Workflow.start_picking(order.id)
      {:ok, _} = Relay.Orders.Workflow.mark_packed(order.id)

      conn = post(conn, ~p"/api/v1/orders/#{order.id}/cancel")

      assert %{"error" => %{"code" => "invalid_transition", "from" => "packed"}} =
               json_response(conn, 409)
    end
  end

  describe "ops endpoints" do
    test "health reports ok", %{conn: conn} do
      assert %{"status" => "ok"} = conn |> get(~p"/api/v1/health") |> json_response(200)
    end

    test "metrics returns the dashboard summary", %{conn: conn} do
      assert %{"data" => data} = conn |> get(~p"/api/v1/metrics") |> json_response(200)
      assert Map.has_key?(data, "orders_today")
      assert Map.has_key?(data, "status_counts")
    end
  end
end
