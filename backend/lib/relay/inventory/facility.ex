defmodule Relay.Inventory.Facility do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id
  schema "facilities" do
    field :code, :string
    field :name, :string
    field :city, :string
    field :region, :string

    timestamps(type: :utc_datetime_usec)
  end

  def changeset(facility, attrs) do
    facility
    |> cast(attrs, [:code, :name, :city, :region])
    |> validate_required([:code, :name, :city, :region])
    |> unique_constraint(:code)
  end
end
