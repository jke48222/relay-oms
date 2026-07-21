import { useState } from 'react'
import type { FormEvent } from 'react'
import { NavLink, Route, Routes, useNavigate } from 'react-router-dom'
import { useRealtime } from './realtime/RealtimeProvider'
import { api } from './api/client'
import {
  IconBell,
  IconBlueprint,
  IconBox,
  IconCart,
  IconCollapse,
  IconGrid,
  IconLayers,
  IconSearch,
} from './components/Icons'
import { Overview } from './pages/Overview'
import { Orders } from './pages/Orders'
import { OrderDetail } from './pages/OrderDetail'
import { NewOrder } from './pages/NewOrder'
import { Products } from './pages/Products'
import { Inventory } from './pages/Inventory'
import { About } from './pages/About'
import { NotFound } from './pages/NotFound'

const nav = ({ isActive }: { isActive: boolean }) => (isActive ? 'on' : '')

export default function App() {
  const { connected, metrics } = useRealtime()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)
  const [query, setQuery] = useState('')

  const exceptions = metrics?.exceptions ?? 0

  async function submitSearch(e: FormEvent) {
    e.preventDefault()
    const term = query.trim()
    if (!term) return

    // Exactly one match jumps straight to the order; otherwise show the
    // filtered list.
    try {
      const page = await api.orders({ number: term, page_size: 2 })
      if (page.data.length === 1) {
        navigate(`/orders/${page.data[0].id}`)
        setQuery('')
        return
      }
    } catch {
      // fall through to the list view, which surfaces its own errors
    }

    navigate(`/orders?number=${encodeURIComponent(term)}`)
    setQuery('')
  }

  return (
    <div className={`shell ${collapsed ? 'collapsed' : ''}`}>
      <aside className="sidebar">
        <div className="sidebar-head">
          <span className="logo">
            Relay
            <span className="logo-badge">R</span>
          </span>
          <button
            className="collapse-btn"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <IconCollapse />
          </button>
        </div>

        <nav className="sidenav" aria-label="Primary">
          <NavLink to="/" end className={nav}>
            <IconGrid />
            <span>Overview</span>
          </NavLink>
          <NavLink to="/orders" className={nav}>
            <IconCart />
            <span>Orders</span>
          </NavLink>
          <NavLink to="/products" className={nav}>
            <IconBox />
            <span>Products</span>
          </NavLink>
          <NavLink to="/inventory" className={nav}>
            <IconLayers />
            <span>Inventory</span>
          </NavLink>
          <NavLink to="/about" className={nav}>
            <IconBlueprint />
            <span>Architecture</span>
          </NavLink>
        </nav>

        <div className="sidebar-foot">
          <div className={`conn-pill ${connected ? '' : 'off'}`} role="status">
            <span className="conn-dot" aria-hidden />
            <span>{connected ? 'Live · connected' : 'Reconnecting…'}</span>
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <form className="search" onSubmit={submitSearch} role="search">
            <IconSearch />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search order number…"
              aria-label="Search orders by number"
            />
          </form>

          <div className="topbar-right">
            <button
              className="bell"
              onClick={() => navigate('/orders?status=exception')}
              aria-label={`${exceptions} orders need attention`}
              title="Orders needing attention"
            >
              <IconBell />
              {exceptions > 0 && <span className="badge">{exceptions}</span>}
            </button>

            <div className="who">
              <span className="avatar" aria-hidden>
                JE
              </span>
              <span>
                <span className="who-name">Jalen Edusei</span>
                <br />
                <span className="who-role">Fulfillment ops</span>
              </span>
            </div>
          </div>
        </header>

        <main className="page">
          <Routes>
            <Route path="/" element={<Overview />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/orders/new" element={<NewOrder />} />
            <Route path="/orders/:id" element={<OrderDetail />} />
            <Route path="/products" element={<Products />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/about" element={<About />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}
