defmodule Relay.Repo.Migrations.CreateOrders do
  use Ecto.Migration

  @statuses ~w(received allocated picking packed shipped delivered exception cancelled)

  def change do
    create table(:orders, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :number, :string, null: false
      add :status, :string, null: false, default: "received"
      add :channel, :string, null: false
      add :customer_name, :string, null: false
      add :destination_city, :string, null: false
      add :destination_region, :string, null: false
      add :total_cents, :integer, null: false, default: 0
      add :facility_id, references(:facilities, type: :binary_id, on_delete: :nilify_all)
      add :idempotency_key, :string
      add :placed_at, :utc_datetime_usec, null: false

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:orders, [:number])
    create unique_index(:orders, [:idempotency_key])
    create index(:orders, [:status])
    create index(:orders, [:channel])
    create index(:orders, [:placed_at])

    create constraint(:orders, :status_must_be_valid,
             check: "status in ('#{Enum.join(@statuses, "','")}')"
           )

    create table(:order_line_items, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :order_id, references(:orders, type: :binary_id, on_delete: :delete_all), null: false
      add :product_id, references(:products, type: :binary_id, on_delete: :restrict), null: false
      add :quantity, :integer, null: false
      add :unit_price_cents, :integer, null: false

      timestamps(type: :utc_datetime_usec)
    end

    create index(:order_line_items, [:order_id])
    create index(:order_line_items, [:product_id])
    create constraint(:order_line_items, :quantity_positive, check: "quantity > 0")
  end
end
