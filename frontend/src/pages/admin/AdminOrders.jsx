import { useCallback, useEffect, useState } from 'react'
import { api, formatINR } from '../../api'
import { STATUS_TONE } from './AdminDashboard'
import LocationMap from '../../components/LocationMap'

const STATUSES = ['Order Confirmed', 'Packed', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled']

/** Quick presets for the most common warehouse updates. */
const QUICK_NOTES = [
  { title: 'Called customer', note: 'Confirmed the delivery slot with the customer.' },
  { title: 'Left for packing', note: 'Items moved to the packing section.' },
  { title: 'Address issue', note: 'Customer asked to update the delivery address.' },
  { title: 'Out for pickup', note: 'Handed over to the delivery partner.' },
]

export default function AdminOrders() {
  const [orders, setOrders] = useState([])
  const [filter, setFilter] = useState('')
  const [error, setError] = useState('')
  const [open, setOpen] = useState(null)
  const [events, setEvents] = useState([])
  const [note, setNote] = useState({ title: '', note: '' })
  const [searches, setSearches] = useState([])

  const load = useCallback(async () => {
    try {
      setOrders(await api.adminOrders(filter || undefined))
    } catch (e) {
      setError(e.message)
    }
  }, [filter])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    api.adminSearches().then(setSearches).catch(() => {})
  }, [])

  // open the detail modal and pull that order's activity timeline
  const showDetail = (order) => {
    setOpen(order)
    setNote({ title: '', note: '' })
    api.adminOrderEvents(order.order_no).then(setEvents).catch(() => setEvents([]))
  }

  const setStatus = async (orderNo, status) => {
    try {
      const updated = await api.adminSetOrderStatus(orderNo, status)
      setOrders((prev) => prev.map((o) => (o.order_no === orderNo ? updated : o)))
      if (open && open.order_no === orderNo) {
        setOpen(updated)
        api.adminOrderEvents(orderNo).then(setEvents).catch(() => {})
      }
    } catch (e) {
      setError(e.message)
    }
  }

  const addNote = async () => {
    if (!open || note.title.trim().length < 2) return
    try {
      await api.adminAddEvent(open.order_no, {
        title: note.title.trim(),
        note: note.note.trim(),
        source: 'admin',
      })
      setNote({ title: '', note: '' })
      setEvents(await api.adminOrderEvents(open.order_no))
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <>
      <div className="admin-head">
        <h1>Orders ({orders.length})</h1>
        <select className="sort-select" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {error && <div className="error-box">{error}</div>}

      {searches.length > 0 && (
        <div className="admin-card">
          <h3 style={{ marginBottom: 10, fontSize: 16 }}>What customers are searching for</h3>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {searches.map((s) => (
              <span key={s.query} className="badge blue">
                {s.query} · {s.times}
                {s.results === 0 && ' (no results)'}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="admin-card">
        <table className="data">
          <thead>
            <tr>
              <th>Order</th><th>Customer</th><th>Items</th><th>Total</th>
              <th>Date</th><th>Status</th><th>Update status</th><th></th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.order_no}>
                <td><strong>{o.order_no}</strong></td>
                <td>
                  <div>{o.customer_name}</div>
                  <div style={{ color: 'var(--text-2)', fontSize: 12, maxWidth: 220 }}>
                    {o.address}
                  </div>
                </td>
                <td>{o.items.reduce((a, i) => a + i.qty, 0)}</td>
                <td>{formatINR(o.total)}</td>
                <td style={{ fontSize: 12, color: 'var(--text-2)' }}>
                  {o.created_at.replace('T', ' ')}
                </td>
                <td><span className={`badge ${STATUS_TONE[o.status] || 'grey'}`}>{o.status}</span></td>
                <td>
                  <select
                    className="sort-select"
                    style={{ padding: '5px 8px', fontSize: 12 }}
                    value={o.status}
                    onChange={(e) => setStatus(o.order_no, e.target.value)}
                  >
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td>
                  <button className="btn-sm blue" onClick={() => showDetail(o)}>Details</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {orders.length === 0 && (
          <p style={{ padding: 20, textAlign: 'center', color: 'var(--text-2)' }}>
            No orders found.
          </p>
        )}
      </div>

      {open && (
        <div className="admin-modal" onClick={() => setOpen(null)}>
          <div className="box" onClick={(e) => e.stopPropagation()}>
            <h3>Order {open.order_no}</h3>
            <p style={{ color: 'var(--text-2)', fontSize: 13, marginBottom: 14 }}>
              {open.customer_name} · {open.created_at.replace('T', ' ')}
              <br />
              {open.address}
            </p>

            {open.lat != null && (
              <div style={{ marginBottom: 14 }}>
                <LocationMap lat={open.lat} lng={open.lng} height={170} />
              </div>
            )}
            <table className="data" style={{ minWidth: 0 }}>
              <thead>
                <tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr>
              </thead>
              <tbody>
                {open.items.map((i) => (
                  <tr key={i.slug}>
                    <td>{i.name}<div style={{ color: 'var(--text-2)', fontSize: 12 }}>{i.unit}</div></td>
                    <td>{i.qty}</td>
                    <td>{formatINR(i.price)}</td>
                    <td>{formatINR(i.price * i.qty)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ marginTop: 14, fontWeight: 600 }}>
              Order total: {formatINR(open.total)}
            </div>

            <h4 style={{ fontSize: 14, margin: '18px 0 8px' }}>
              Activity ({events.length})
            </h4>
            <div className="timeline" style={{ maxHeight: 220, overflowY: 'auto' }}>
              {events.length === 0 && (
                <p style={{ color: 'var(--text-2)', fontSize: 13 }}>No activity logged yet.</p>
              )}
              {events.map((e) => (
                <div key={e.id} className={`timeline-item ${e.source}`}>
                  <span className="timeline-dot">•</span>
                  <div className="timeline-body">
                    <div className="timeline-head">
                      <strong>{e.title}</strong>
                      <span className="timeline-time">{e.created_at.replace('T', ' ')}</span>
                    </div>
                    {e.note && <p>{e.note}</p>}
                    <span className="timeline-source">
                      {e.source === 'customer' ? 'Customer' : 'Store team'}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <h4 style={{ fontSize: 14, margin: '18px 0 8px' }}>Add an update</h4>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              {QUICK_NOTES.map((n) => (
                <button
                  key={n.title}
                  className="btn-sm grey"
                  onClick={() => setNote({ title: n.title, note: n.note })}
                >
                  + {n.title}
                </button>
              ))}
            </div>
            <div className="field">
              <input
                value={note.title}
                onChange={(e) => setNote({ ...note, title: e.target.value })}
                placeholder="Update title (e.g. Called customer)"
              />
            </div>
            <div className="field">
              <textarea
                rows="2"
                value={note.note}
                onChange={(e) => setNote({ ...note, note: e.target.value })}
                placeholder="Details for this update"
              />
            </div>
            <button className="btn-sm green" style={{ marginTop: 4 }} onClick={addNote}>
              LOG UPDATE
            </button>
            <div className="modal-actions">
              <button className="btn-sm grey" onClick={() => setOpen(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}