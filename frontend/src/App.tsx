import { NavLink, Route, Routes } from 'react-router-dom'
import { useRealtime } from './realtime/RealtimeProvider'
import { Dashboard } from './pages/Dashboard'
import { Orders } from './pages/Orders'
import { OrderDetail } from './pages/OrderDetail'
import { Inventory } from './pages/Inventory'
import { About } from './pages/About'

const nav = ({ isActive }: { isActive: boolean }) => (isActive ? 'on' : '')

export default function App() {
  const { connected } = useRealtime()

  return (
    <>
      <header className="topbar">
        <div className="brandmark">
          <span className="dot" />
          RELAY&nbsp;<span className="faint">/ OMS</span>
        </div>
        <nav className="topnav">
          <NavLink to="/" end className={nav}>
            Dashboard
          </NavLink>
          <NavLink to="/orders" className={nav}>
            Orders
          </NavLink>
          <NavLink to="/inventory" className={nav}>
            Inventory
          </NavLink>
          <NavLink to="/about" className={nav}>
            Architecture
          </NavLink>
        </nav>
        <span className={`live-dot ${connected ? 'on' : ''}`}>
          {connected ? 'Live' : 'Connecting'}
        </span>
      </header>

      <main className="wrap">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/orders/:id" element={<OrderDetail />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/about" element={<About />} />
        </Routes>
      </main>
    </>
  )
}
