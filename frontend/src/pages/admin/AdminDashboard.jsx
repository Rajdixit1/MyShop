import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, formatINR } from '../../api'

export const STATUS_TONE = {
  'Order Confirmed': 'blue',
  Packed: 'orange',
  Shipped: 'blue',
  'Out for Delivery': 'orange',
  Delivered: 'green',
  Cancelled: 'red',
}

export default function AdminDashboard() {
  const [stats, setStats] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.adminStats().then(setStats).catch((e) => setError(e.message))
  }, [])

  if (error) return <div className="error-box">{error}</div>
  if (!stats) return <div className="spinner" />

  const cards = [
    { label: 'Total Revenue', value: formatINR(stats.total_revenue), tone: 'green' },
    { label: 'Total Orders', value: stats.total_orders, tone: '' },
    { label: 'Products', value: stats.total_products, tone: '' },
    { label: 'Customers', value: stats.total_users, tone: '' },
    { label: 'Low Stock (<20)', value: stats.low_stock_count, tone: 'orange' },
    { label: 'Out of Stock', value: stats.out_of_stock_count, tone: 'red' },
  ]

  return (
    <>
      <div className="admin-head">
        <h1>Dashboard</h1>
        <Link className="btn-sm blue" to="/admin/products">Manage Products</Link>
      </div>

      <div className="stat-grid">
        {cards.map((c) => (
          <div key={c.label} className={`stat-card ${c.tone}`}>
            <div className="label">{c.label}</div>
            <div className="value">{c.value}</div>
          </div>
        ))}
      </div>

      <div className="admin-card">
        <h3 style={{ marginBottom: 12, fontSize: 16 }}>Orders by status</h3>
        {Object.keys(stats.orders_by_status).length === 0 ? (
          <p style={{ color: 'var(--text-2)' }}>No orders yet.</p>
        ) : (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {Object.entries(stats.orders_by_status).map(([status, count]) => (
              <span key={status} className={`badge ${STATUS_TONE[status] || 'grey'}`}>
                {status}: {count}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="admin-card">
        <h3 style={{ marginBottom: 12, fontSize: 16 }}>Best selling products</h3>
        {stats.top_products.length === 0 ? (
          <p style={{ color: 'var(--text-2)' }}>No sales recorded yet.</p>
        ) : (
          <table className="data">
            <thead>
              <tr><th>#</th><th>Product</th><th>Units sold</th><th>Revenue</th></tr>
            </thead>
            <tbody>
              {stats.top_products.map((p, i) => (
                <tr key={p.slug}>
                  <td>{i + 1}</td>
                  <td>{p.name}</td>
                  <td>{p.sold}</td>
                  <td>{formatINR(p.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="admin-card">
        <h3 style={{ marginBottom: 12, fontSize: 16 }}>Recent orders</h3>
        {stats.recent_orders.length === 0 ? (
          <p style={{ color: 'var(--text-2)' }}>No orders yet.</p>
        ) : (
          <table className="data">
            <thead>
              <tr><th>Order</th><th>Customer</th><th>Items</th><th>Total</th><th>Status</th></tr>
            </thead>
            <tbody>
              {stats.recent_orders.map((o) => (
                <tr key={o.order_no}>
                  <td><strong>{o.order_no}</strong></td>
                  <td>{o.customer_name}</td>
                  <td>{o.items.reduce((a, i) => a + i.qty, 0)}</td>
                  <td>{formatINR(o.total)}</td>
                  <td>
                    <span className={`badge ${STATUS_TONE[o.status] || 'grey'}`}>{o.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}