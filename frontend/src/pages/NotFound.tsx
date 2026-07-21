import { Link } from 'react-router-dom'
import { usePageTitle } from '../hooks/usePageTitle'

export function NotFound() {
  usePageTitle('Not found')
  return (
    <section className="card" style={{ maxWidth: 520, margin: '48px auto', textAlign: 'center' }}>
      <h3 style={{ fontSize: 20 }}>Nothing at this address</h3>
      <p className="muted">
        The page you're after doesn't exist — maybe the order number went in the topbar
        search instead?
      </p>
      <Link to="/" className="btn" style={{ marginTop: 8 }}>
        Back to Overview
      </Link>
    </section>
  )
}
