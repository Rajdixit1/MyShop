import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAdmin } from '../../context/AdminContext'

const LINKS = [
  ['/admin', '📊', 'Dashboard'],
  ['/admin/products', '📦', 'Products'],
  ['/admin/orders', '🧾', 'Orders'],
  ['/admin/customers', '👥', 'Customers'],
  ['/admin/store', '🏪', 'View Store'],
]

export default function AdminLayout() {
  const { admin, logout } = useAdmin()
  const navigate = useNavigate()

  const signOut = () => {
    logout()
    navigate('/admin/login')
  }

  return (
    <div className="admin-shell">
      <aside className="admin-side">
        <div className="admin-brand">🛒 Admin Panel</div>
        {LINKS.map(([to, emoji, label]) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/admin'}
            className={({ isActive }) => `admin-link ${isActive ? 'active' : ''}`}
          >
            <span>{emoji}</span>
            {label}
          </NavLink>
        ))}
        <div style={{ padding: '18px', marginTop: 10, borderTop: '1px solid #263449' }}>
          <div style={{ color: '#8fa3bd', fontSize: 12, marginBottom: 10 }}>
            Signed in as <strong style={{ color: '#fff' }}>{admin?.username}</strong>
          </div>
          <button className="btn-sm red" onClick={signOut}>Sign out</button>
        </div>
      </aside>
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  )
}