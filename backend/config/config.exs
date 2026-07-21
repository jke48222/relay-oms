# This file is responsible for configuring your application
# and its dependencies with the aid of the Config module.
#
# This configuration file is loaded before any dependency and
# is restricted to this project.

# General application configuration
import Config

config :relay,
  ecto_repos: [Relay.Repo],
  generators: [timestamp_type: :utc_datetime, binary_id: true]

# Configure the endpoint
config :relay, RelayWeb.Endpoint,
  url: [host: "localhost"],
  adapter: Bandit.PhoenixAdapter,
  render_errors: [
    formats: [json: RelayWeb.ErrorJSON],
    layout: false
  ],
  pubsub_server: Relay.PubSub,
  live_view: [signing_salt: "PeTZGo1s"]

# Configure Elixir's Logger
config :logger, :default_formatter,
  format: "$time $metadata[$level] $message\n",
  metadata: [:request_id]

# Use Jason for JSON parsing in Phoenix
config :phoenix, :json_library, Jason

# Fulfillment pipeline: consumes order events and advances the lifecycle.
# Delays are per-step base values in ms (each gets +0–50% jitter).
config :relay, Relay.Fulfillment.Pipeline,
  enabled: true,
  step_delays_ms: [
    allocate: 500,
    start_picking: 2_000,
    mark_packed: 2_500,
    ship: 3_000,
    mark_delivered: 8_000
  ]

# Import environment specific config. This must remain at the bottom
# of this file so it overrides the configuration defined above.
import_config "#{config_env()}.exs"
