import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, formatINR } from '../api'
import { useAuth } from '../context/AuthContext'

const TONE = {
  'Order Confirmed': 'blue',
  Packed: 'orange',
  Shipped: 'blue',
  'Out for Delivery': 'orange',
  Delivered: 'green',
  Cancelled: 'red',
}

export default function MyOrders() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    api
      .myOrders()
      .then(setOrders)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (user) load()
  }, [user, load])

  if (!user) {
    return (
      <div className="container">
        <div className="empty" style={{ marginTop: 12 }}>
          <div className="empty-emoji">👤</div>
          <h3>Please login to see your orders</h3>
          <p>Login to track your deliveries and reorder quickly.</p>
          <button className="btn-blue" onClick={() => navigate('/login')}>LOGIN NOW</button>
        </div>
      </div>
    )
  }

  const spend = orders.reduce((a, o) => a + o.total, 0)

  return (
    <div className="container">
      <div className="list-head" style={{ marginTop: 12 }}>
        <span className="list-title">
          {user.name} · +91 {user.phone}
        </span>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link className="link-btn" to="/products" style={{ color: 'var(--blue)' }}>
            CONTINUE SHOPPING
          </Link>
          <button
            className="link-btn"
            onClick={() => { logout(); navigate('/') }}
          >
            LOGOUT
          </button>
        </div>
      </div>

      <div className="cart-layout">
        <div className="form-card">
          <h3 style={{ fontSize: 16, marginBottom: 12 }}>My Orders ({orders.length})</h3>

          {loading ? (
            <div className="spinner" />
          ) : error ? (
            <div className="error-box">{error}</div>
          ) : orders.length === 0 ? (
            <div className="empty" style={{ padding: '40px 20px' }}>
              <div className="empty-emoji">🧾</div>
              <h3>No orders yet</h3>
              <p>Your placed orders will show up here.</p>
              <button className="btn-blue" onClick={() => navigate('/products')}>START SHOPPING</button>
            </div>
          ) : (
            orders.map((o) => (
              <div key={o.order_no} style={{ borderBottom: '1px solid var(--border)', padding: '16px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <strong style={{ color: 'var(--blue)' }}>{o.order_no}</strong>
                    <div style={{ color: 'var(--text-2)', fontSize: 12 }}>
                      {o.created_at.replace('T', ' ')}
                    </div>
                  </div>
                  <span className={`badge ${TONE[o.status] || 'grey'}`}>{o.status}</span>
                </div>

                <div style={{ margin: '10px 0', fontSize: 13 }}>
                  {o.items.map((i) => (
                    <div key={i.slug} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                      <span>{i.name} <span style={{ color: 'var(--text-2)' }}>× {i.qty}</span></span>
                      <span>₹{(i.price * i.qty).toFixed(0)}</span>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                  <span>Total</span>
                  <span>{formatINR(o.total)}</span>
                </div>

                <button
                  className="btn-blue"
                  style={{ marginTop: 12, width: '100%' }}
                  onClick={() => navigate(`/track/${o.order_no}`)}
                >
                  📍 TRACK ORDER
                </button>
              </div>
            ))
          )}
        </div>

        <div className="price-box">
          <div className="price-row total">
            <span>Lifetime spend</span>
            <span>{formatINR(spend)}</span>
          </div>
          <div className="price-row">
            <span>Orders placed</span>
            <span>{orders.length}</span>
          </div>
          <div className="saving-box">Free delivery on every order above ₹499</div>
          <Link to="/products" className="btn-green" style={{ display: 'block', textAlign: 'center' }}>
            SHOP AGAIN
          </Link>
        </div>
      </div>
    </div>
  )
}