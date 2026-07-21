defmodule RelayWeb.API.OrderController do
  use RelayWeb, :controller

  alias Relay.Orders
  alias Relay.Orders.Workflow
  alias RelayWeb.API.JSON, as: Serialize

  action_fallback RelayWeb.API.FallbackController

  def index(conn, params) do
    page = Orders.list_orders(params)

    json(conn, %{
      data: Enum.map(page.orders, &Serialize.order/1),
      meta: %{page: page.page, page_size: page.page_size, total: page.total}
    })
  end

  def show(conn, %{"id" => id}) do
    with {:ok, order} <- Orders.fetch_order(id) do
      json(conn, %{data: Serialize.order_with_events(order)})
    end
  end

  @doc """
  Create an order. Send an `Idempotency-Key` header (or `idempotency_key` in
  the body) to make retries safe: a replay returns 200 with the original
  order instead of creating a duplicate; a fresh create returns 201.
  """
  def create(conn, params) do
    params = Map.put_new(params, "idempotency_key", idempotency_header(conn))

    with {:ok, order, mode} <- Workflow.create_order(params) do
      conn
      |> put_status(if(mode == :created, do: :created, else: :ok))
      |> json(%{data: Serialize.order(order), meta: %{idempotent_replay: mode == :replayed}})
    end
  end

  def cancel(conn, %{"id" => id}) do
    with {:ok, order} <- Orders.fetch_order(id),
         {:ok, cancelled} <- Workflow.cancel_order(order.id) do
      json(conn, %{data: Serialize.order(cancelled)})
    end
  end

  defp idempotency_header(conn) do
    case get_req_header(conn, "idempotency-key") do
      [key | _] when byte_size(key) > 0 -> key
      _ -> nil
    end
  end
end
