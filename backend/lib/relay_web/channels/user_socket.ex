defmodule RelayWeb.UserSocket do
  use Phoenix.Socket

  channel "dashboard:*", RelayWeb.DashboardChannel

  # The dashboard is read-only telemetry; no auth needed for the demo.
  # At Stord this is where a JWT from the SPA would be verified.
  @impl true
  def connect(_params, socket, _connect_info), do: {:ok, socket}

  @impl true
  def id(_socket), do: nil
end
