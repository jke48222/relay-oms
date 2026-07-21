defmodule RelayWeb.Router do
  use RelayWeb, :router

  pipeline :api do
    plug :accepts, ["json"]
  end

  scope "/api/v1", RelayWeb.API do
    pipe_through :api

    get "/health", OpsController, :health
    get "/metrics", OpsController, :metrics
    get "/events", OpsController, :events
    post "/simulate", OpsController, :simulate

    get "/products", CatalogController, :products
    get "/facilities", CatalogController, :facilities
    get "/inventory", CatalogController, :inventory

    get "/orders", OrderController, :index
    post "/orders", OrderController, :create
    get "/orders/:id", OrderController, :show
    post "/orders/:id/cancel", OrderController, :cancel
  end

  # Enable LiveDashboard and Swoosh mailbox preview in development
  if Application.compile_env(:relay, :dev_routes) do
    # If you want to use the LiveDashboard in production, you should put
    # it behind authentication and allow only admins to access it.
    # If your application does not have an admins-only section yet,
    # you can use Plug.BasicAuth to set up some basic authentication
    # as long as you are also using SSL (which you should anyway).
    import Phoenix.LiveDashboard.Router

    scope "/dev" do
      pipe_through [:fetch_session, :protect_from_forgery]

      live_dashboard "/dashboard", metrics: RelayWeb.Telemetry
      forward "/mailbox", Plug.Swoosh.MailboxPreview
    end
  end
end
