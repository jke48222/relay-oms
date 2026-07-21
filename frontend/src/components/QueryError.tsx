interface QueryErrorProps {
  /** What failed to load, e.g. "orders" — rendered in the message. */
  what: string
  onRetry: () => void
}

/**
 * Shared failure state for any query-backed section: a live-demo blip shows
 * "couldn't load X — retry" instead of a blank card or perpetual spinner.
 */
export function QueryError({ what, onRetry }: QueryErrorProps) {
  return (
    <div className="error-card" role="alert">
      <p>Couldn't load {what} — the API may be unreachable.</p>
      <button className="btn danger small" onClick={onRetry}>
        Retry
      </button>
    </div>
  )
}
