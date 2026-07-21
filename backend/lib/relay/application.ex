defmodule Relay.Application do
  # See https://elixir.hexdocs.pm/Application.html
  # for more information on OTP Applications
  @moduledoc false

  use Application

  @impl true
  def start(_type, _args) do
    children = [
      RelayWeb.Telemetry,
      Relay.Repo,
      {DNSCluster, query: Application.get_env(:relay, :dns_cluster_query) || :ignore},
      {Phoenix.PubSub, name: Relay.PubSub},
      # Start to serve requests, typically the last entry
      RelayWeb.Endpoint
    ]

    # The fulfillment pipeline consumes order events and advances orders
    # through the lifecycle. Disabled in test — tests drive the workflow
    # directly for deterministic assertions.
    children =
      if Application.get_env(:relay, Relay.Fulfillment.Pipeline)[:enabled] do
        children ++ [Relay.Fulfillment.Pipeline]
      else
        children
      end

    # See https://elixir.hexdocs.pm/Supervisor.html
    # for other strategies and supported options
    opts = [strategy: :one_for_one, name: Relay.Supervisor]
    Supervisor.start_link(children, opts)
  end

  # Tell Phoenix to update the endpoint configuration
  # whenever the application is updated.
  @impl true
  def config_change(changed, _new, removed) do
    RelayWeb.Endpoint.config_change(changed, removed)
    :ok
  end
end
