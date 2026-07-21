defmodule RelayWeb.API.FallbackController do
  @moduledoc """
  One place that turns domain errors into HTTP. Controllers stay thin: they
  return `{:error, ...}` and every error response in the API shares the same
  `{"error": {"code": ..., ...}}` shape.
  """

  use RelayWeb, :controller

  def call(conn, {:error, :not_found}) do
    conn
    |> put_status(:not_found)
    |> json(%{error: %{code: "not_found"}})
  end

  def call(conn, {:error, %Ecto.Changeset{} = changeset}) do
    errors =
      Ecto.Changeset.traverse_errors(changeset, fn {msg, opts} ->
        Enum.reduce(opts, msg, fn {key, value}, acc ->
          String.replace(acc, "%{#{key}}", to_string(value))
        end)
      end)

    conn
    |> put_status(:unprocessable_entity)
    |> json(%{error: %{code: "validation_failed", fields: errors}})
  end

  def call(conn, {:error, {:invalid_transition, from, to}}) do
    conn
    |> put_status(:conflict)
    |> json(%{error: %{code: "invalid_transition", from: from, to: to}})
  end

  def call(conn, {:error, :no_line_items}) do
    conn
    |> put_status(:unprocessable_entity)
    |> json(%{error: %{code: "no_line_items", message: "order needs at least one line item"}})
  end

  def call(conn, {:error, {:unknown_product, id}}) do
    conn
    |> put_status(:unprocessable_entity)
    |> json(%{error: %{code: "unknown_product", product_id: id}})
  end
end
