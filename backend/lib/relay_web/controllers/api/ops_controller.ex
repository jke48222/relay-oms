defmodule RelayWeb.API.OpsController do
  @moduledoc """
  Operational endpoints: the event feed, dashboard metrics, demo traffic,
  and the health probe Kubernetes points its liveness/readiness checks at.
  """

  use RelayWeb, :controller

  alias Relay.{Events, Metrics, Repo, Simulator}
  alias RelayWeb.API.JSON, as: Serialize

  def events(conn, params) do
    limit =
      case Integer.parse(to_string(params["limit"] || "50")) do
        {n, ""} when n in 1..200 -> n
        _ -> 50
      end

    json(conn, %{data: Enum.map(Events.list_recent(limit), &Serialize.event/1)})
  end

  def metrics(conn, _params) do
    json(conn, %{data: Metrics.summary()})
  end

  def simulate(conn, params) do
    count =
      case params["count"] do
        n when is_integer(n) -> n
        s when is_binary(s) -> with({n, ""} <- Integer.parse(s), do: n, else: (_ -> 5))
        _ -> 5
      end

    numbers = Simulator.run(count)

    conn
    |> put_status(:accepted)
    |> json(%{data: %{created: numbers, count: length(numbers)}})
  end

  def health(conn, _params) do
    case Repo.query("SELECT 1") do
      {:ok, _} ->
        json(conn, %{status: "ok", version: Application.spec(:relay, :vsn) |> to_string()})

      {:error, _} ->
        conn |> put_status(:service_unavailable) |> json(%{status: "degraded", database: "down"})
    end
  end
end
