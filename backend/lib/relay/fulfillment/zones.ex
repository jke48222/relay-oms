defmodule Relay.Fulfillment.Zones do
  @moduledoc """
  Coarse US shipping zones, used to prefer the facility nearest an order's
  destination when more than one can fulfill it. A real network would rate
  actual transit times per carrier lane; three zones is enough to make the
  routing decision visible in a demo.
  """

  @west ~w(WA OR CA NV ID UT AZ MT WY CO NM AK HI)
  @central ~w(ND SD NE KS OK TX MN IA MO AR LA WI IL MS)

  def zone_for(region) when region in @west, do: :west
  def zone_for(region) when region in @central, do: :central
  def zone_for(_region), do: :east
end
