defmodule Relay.Orders.StateMachine do
  @moduledoc """
  The order lifecycle, as one explicit map.

  Happy path: received → allocated → picking → packed → shipped → delivered.
  Exceptions: allocation failure parks an order in `exception` (it can be
  retried once stock returns, or cancelled). Cancellation is allowed any time
  before the box leaves the building — once `packed`, it ships.
  """

  @transitions %{
    "received" => ~w(allocated exception cancelled),
    "allocated" => ~w(picking cancelled),
    "picking" => ~w(packed cancelled),
    "packed" => ~w(shipped),
    "shipped" => ~w(delivered),
    "delivered" => [],
    "exception" => ~w(received cancelled),
    "cancelled" => []
  }

  @doc "All states that can follow `status`."
  def next_states(status), do: Map.get(@transitions, status, [])

  @doc "Whether `from -> to` is a legal move."
  def can_transition?(from, to), do: to in next_states(from)

  @doc "States from which an order can still be cancelled."
  def cancellable_states do
    for {from, tos} <- @transitions, "cancelled" in tos, do: from
  end

  def transitions, do: @transitions
end
