defmodule Relay.Simulator do
  @moduledoc """
  Demo traffic: create a burst of plausible orders through the REAL pipeline
  (`Workflow.create_order/1`), never by inserting rows directly — every
  simulated order earns its event history the same way a Shopify webhook
  would. A slice of the burst deliberately chases the scarce SKU so
  allocation exceptions show up too.
  """

  alias Relay.Catalog
  alias Relay.Orders.Order
  alias Relay.Orders.Workflow

  @max_burst 25

  @customers [
    "Amara Okafor",
    "Marcus Chen",
    "Priya Patel",
    "Jordan Rivera",
    "Sofia Rossi",
    "DeShawn Williams",
    "Emma Larsen",
    "Kenji Tanaka",
    "Isabella Garcia",
    "Liam O'Brien",
    "Zoe Jackson",
    "Rahul Sharma",
    "Ava Thompson",
    "Mateo Hernandez",
    "Nia Roberts"
  ]

  @destinations [
    {"Atlanta", "GA"},
    {"Decatur", "GA"},
    {"Charlotte", "NC"},
    {"Miami", "FL"},
    {"Nashville", "TN"},
    {"New York", "NY"},
    {"Columbus", "OH"},
    {"Chicago", "IL"},
    {"Dallas", "TX"},
    {"Austin", "TX"},
    {"Denver", "CO"},
    {"Phoenix", "AZ"},
    {"Las Vegas", "NV"},
    {"Los Angeles", "CA"},
    {"Seattle", "WA"},
    {"Portland", "OR"}
  ]

  def max_burst, do: @max_burst

  @doc "Create `count` random orders. Returns the created orders' numbers."
  def run(count) when is_integer(count) and count >= 1 do
    count = min(count, @max_burst)
    products = Catalog.list_products()
    scarce = Enum.find(products, &(&1.sku == "SUNGLASS-OG-POLAR"))

    for _ <- 1..count do
      {city, region} = Enum.random(@destinations)

      {:ok, order, :created} =
        Workflow.create_order(%{
          channel: Enum.random(Order.channels()),
          customer_name: Enum.random(@customers),
          destination_city: city,
          destination_region: region,
          line_items: line_items(products, scarce)
        })

      order.number
    end
  end

  def run(_), do: []

  # 1–3 distinct products, qty 1–3 each; ~15% of orders instead chase the
  # scarce SKU hard enough to strain the 12 units in DFW.
  defp line_items(products, scarce) do
    if scarce && :rand.uniform(100) <= 15 do
      [%{product_id: scarce.id, quantity: 3 + :rand.uniform(4)}]
    else
      products
      |> Enum.reject(&(&1.sku == "SUNGLASS-OG-POLAR"))
      |> Enum.take_random(:rand.uniform(3))
      |> Enum.map(fn product ->
        %{product_id: product.id, quantity: :rand.uniform(3)}
      end)
    end
  end
end
