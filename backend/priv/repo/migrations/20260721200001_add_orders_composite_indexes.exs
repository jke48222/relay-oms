defmodule Relay.Repo.Migrations.AddOrdersCompositeIndexes do
  use Ecto.Migration

  # The orders list always filters by status/channel AND sorts by placed_at;
  # composite indexes let Postgres serve filter + sort from one index scan.
  def change do
    create index(:orders, [:status, :placed_at])
    create index(:orders, [:channel, :placed_at])
  end
end
