defmodule Relay.Repo.Migrations.CreateOrderEvents do
  use Ecto.Migration

  def change do
    # Append-only event log, written in the same transaction as the state it
    # describes (transactional outbox). `sequence` gives a total order across
    # the whole stream — the equivalent of a Kafka topic offset.
    create table(:order_events, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :sequence, :bigserial, null: false
      add :order_id, references(:orders, type: :binary_id, on_delete: :delete_all), null: false
      add :type, :string, null: false
      add :payload, :map, null: false, default: %{}
      add :inserted_at, :utc_datetime_usec, null: false
    end

    create unique_index(:order_events, [:sequence])
    create index(:order_events, [:order_id])
    create index(:order_events, [:type])
  end
end
