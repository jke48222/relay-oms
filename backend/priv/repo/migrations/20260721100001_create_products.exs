defmodule Relay.Repo.Migrations.CreateProducts do
  use Ecto.Migration

  def change do
    create table(:products, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :sku, :string, null: false
      add :name, :string, null: false
      add :unit_price_cents, :integer, null: false

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:products, [:sku])
    create constraint(:products, :unit_price_nonnegative, check: "unit_price_cents >= 0")
  end
end
