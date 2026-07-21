defmodule Relay.Repo.Migrations.CreateInventoryItems do
  use Ecto.Migration

  def change do
    create table(:inventory_items, primary_key: false) do
      add :id, :binary_id, primary_key: true

      add :facility_id, references(:facilities, type: :binary_id, on_delete: :delete_all),
        null: false

      add :product_id, references(:products, type: :binary_id, on_delete: :delete_all),
        null: false

      add :on_hand, :integer, null: false, default: 0
      add :allocated, :integer, null: false, default: 0

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:inventory_items, [:facility_id, :product_id])
    create index(:inventory_items, [:product_id])

    # The database is the last line of defense against overselling: allocation
    # can never exceed stock on hand, and neither count can go negative.
    create constraint(:inventory_items, :on_hand_nonnegative, check: "on_hand >= 0")
    create constraint(:inventory_items, :allocated_nonnegative, check: "allocated >= 0")
    create constraint(:inventory_items, :allocated_within_on_hand, check: "allocated <= on_hand")
  end
end
