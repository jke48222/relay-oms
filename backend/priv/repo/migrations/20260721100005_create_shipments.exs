defmodule Relay.Repo.Migrations.CreateShipments do
  use Ecto.Migration

  def change do
    create table(:shipments, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :order_id, references(:orders, type: :binary_id, on_delete: :delete_all), null: false
      add :carrier, :string, null: false
      add :tracking_number, :string, null: false
      add :shipped_at, :utc_datetime_usec, null: false
      add :delivered_at, :utc_datetime_usec

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:shipments, [:tracking_number])
    create index(:shipments, [:order_id])
  end
end
