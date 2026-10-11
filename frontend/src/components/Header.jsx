import { Link, useNavigate } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { useAuth } from '../context/AuthContext'
import SearchBox from './SearchBox'

export default function Header() {
  const { count } = useCart()
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const onAccount = () => {
    if (user) navigate('/orders')
    else navigate('/login')
  }

  return (
    <header className="header">
      <div className="container header-row">
        <Link to="/" className="logo">
          <span className="logo-mark">🛒</span>
          Devenand Saw Kirana Store
          <sup>Explore+</sup>
        </Link>

        <SearchBox />

        <div className="header-actions">
          <button className="header-btn" onClick={onAccount} data-testid="account-btn">
            <span>{user ? '👋' : '👤'}</span>
            <span>{user ? user.name.split(' ')[0] : 'Login'}</span>
          </button>

          <Link to="/orders" className="header-btn">
            <span>📦</span>
            <span>Orders</span>
          </Link>

          <Link to="/cart" className="header-btn">
            <span>🛒</span>
            <span>Cart</span>
            {count > 0 && <span className="cart-badge">{count}</span>}
          </Link>

          {user && (
            <button className="header-btn" onClick={() => { logout(); navigate('/') }}>
              <span>↩</span>
              <span>Logout</span>
            </button>
          )}
        </div>
      </div>
    </header>
  )
}