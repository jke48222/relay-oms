# Seeds: a small but realistic catalog, four facilities across the US, and
# stock spread unevenly between them (so allocation has real choices to make,
# and one SKU is scarce enough to trigger exceptions during demos).
#
# Orders are intentionally NOT seeded here — they enter through the real
# pipeline (POST /api/v1/orders or /api/v1/simulate) so every order in the
# system has a genuine event history.

alias Relay.{Catalog, Inventory}

products = [
  %{sku: "AG1-TRAVEL-30", name: "AG1 Travel Packs (30ct)", unit_price_cents: 8900},
  %{sku: "TEE-CLASSIC-BLK-L", name: "Classic Tee — Black / L", unit_price_cents: 2400},
  %{sku: "DEO-COCONUT-2PK", name: "Coconut Deodorant 2-Pack", unit_price_cents: 2200},
  %{sku: "PROBIOTIC-DS-01", name: "Daily Synbiotic (30 day)", unit_price_cents: 4999},
  %{sku: "BRUSH-KIT-QUARTZ", name: "Electric Brush Starter Kit", unit_price_cents: 4500},
  %{sku: "SUNGLASS-OG-POLAR", name: "OG Polarized Sunglasses", unit_price_cents: 3500},
  %{sku: "DOGFOOD-FRESH-10", name: "Fresh Dog Food (10 lb)", unit_price_cents: 7900},
  %{sku: "TUMBLER-32-SAGE", name: "32oz Tumbler — Sage", unit_price_cents: 3200}
]

facilities = [
  %{code: "ATL-1", name: "Atlanta Fulfillment Center", city: "Union City", region: "GA"},
  %{code: "LAS-1", name: "Las Vegas Fulfillment Center", city: "North Las Vegas", region: "NV"},
  %{code: "COL-1", name: "Columbus Fulfillment Center", city: "Groveport", region: "OH"},
  %{code: "DFW-1", name: "Dallas Fulfillment Center", city: "Fort Worth", region: "TX"}
]

products =
  for attrs <- products do
    case Catalog.get_product_by_sku(attrs.sku) do
      nil ->
        {:ok, product} = Catalog.create_product(attrs)
        product

      product ->
        product
    end
  end

facilities =
  for attrs <- facilities do
    case Enum.find(Inventory.list_facilities(), &(&1.code == attrs.code)) do
      nil ->
        {:ok, facility} = Inventory.create_facility(attrs)
        facility

      facility ->
        facility
    end
  end

# Stock levels: ATL is the flagship (deep stock), LAS/COL mid, DFW light.
# SUNGLASS-OG-POLAR is deliberately scarce — it exists only in DFW with a
# handful of units, so a burst of orders for it produces allocation
# exceptions you can see on the dashboard.
depth = %{"ATL-1" => 400, "LAS-1" => 180, "COL-1" => 150, "DFW-1" => 60}

for facility <- facilities, product <- products do
  base = depth[facility.code]

  on_hand =
    cond do
      product.sku == "SUNGLASS-OG-POLAR" and facility.code != "DFW-1" -> 0
      product.sku == "SUNGLASS-OG-POLAR" -> 12
      true -> base + :erlang.phash2({facility.code, product.sku}, 120)
    end

  {:ok, _} =
    Inventory.upsert_inventory_item(%{
      facility_id: facility.id,
      product_id: product.id,
      on_hand: on_hand,
      allocated: 0
    })
end

IO.puts("Seeded #{length(products)} products × #{length(facilities)} facilities.")
