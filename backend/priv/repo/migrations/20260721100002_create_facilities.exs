defmodule Relay.Repo.Migrations.CreateFacilities do
  use Ecto.Migration

  def change do
    create table(:facilities, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :code, :string, null: false
      add :name, :string, null: false
      add :city, :string, null: false
      add :region, :string, null: false

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:facilities, [:code])
  end
end
