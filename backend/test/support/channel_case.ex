defmodule RelayWeb.ChannelCase do
  @moduledoc """
  Test case for channel tests, mirroring the generated ConnCase: sets up the
  SQL sandbox and imports Phoenix.ChannelTest with our endpoint.
  """

  use ExUnit.CaseTemplate

  using do
    quote do
      import Phoenix.ChannelTest
      import RelayWeb.ChannelCase

      @endpoint RelayWeb.Endpoint
    end
  end

  setup tags do
    Relay.DataCase.setup_sandbox(tags)
    :ok
  end
end
