import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, formatINR } from '../api'
import { useAuth } from '../context/AuthContext'
import LocationMap from '../components/LocationMap'

/** The delivery stages an order passes through, used to draw the timeline. */
const FLOW = ['Order Confirmed', 'Packed', 'Shipped', 'Out for Delivery', 'Delivered']

const STAGE_ICON = {
  'Order Confirmed': '✅',
  Packed: '📦',
  Shipped: '🚚',
  'Out for Delivery': '🛵',
  Delivered: '🎉',
  Cancelled: '❌',
}

const STAGE_NOTE = {
  'Order Confirmed': 'We have received your order.',
  Packed: 'Your items are packed and ready for pickup.',
  Shipped: 'Your parcel has left the warehouse.',
  'Out for Delivery': 'The delivery agent is on the way.',
  Delivered: 'Delivered. Thank you for shopping with us!',
  Cancelled: 'This order was cancelled.',
}

export default function TrackOrder() {
  const { orderNo } = useParams()
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [note, setNote] = useState({ title: '', note: '' })
  const [noteBusy, setNoteBusy] = useState(false)

  const load = () => {
    setError('')
    api.trackOrder(orderNo).then(setData).catch((e) => setError(e.message))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderNo])

  const submitNote = async (e) => {
    e.preventDefault()
    if (note.title.trim().length < 2) return
    setNoteBusy(true)
    try {
      await api.addOrderNote(orderNo, { title: note.title.trim(), note: note.note.trim() })
      setNote({ title: '', note: '' })
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setNoteBusy(false)
    }
  }

  if (error && !data) {
    return (
      <div className="container">
        <div className="empty" style={{ marginTop: 12 }}>
          <div className="empty-emoji">🔍</div>
          <h3>We could not find that order</h3>
          <p>{error}</p>
          <Link to="/orders" className="btn-blue">MY ORDERS</Link>
        </div>
      </div>
    )
  }

  if (!data) return <div className="spinner" />

  const { order, events, eta, whatsapp_url: whatsappUrl } = data
  const cancelled = order.status === 'Cancelled'
  const stageIndex = cancelled ? -1 : FLOW.indexOf(order.status)
  // events come oldest-first; the activity feed shows newest first
  const activity = [...events].reverse()

  return (
    <div className="container">
      <div className="list-head" style={{ marginTop: 12 }}>
        <span className="list-title">Track order {order.order_no}</span>
        <Link to="/orders" className="link-btn" style={{ color: 'var(--blue)' }}>
          MY ORDERS
        </Link>
      </div>

      <div className="cart-layout">
        <div>
          <div className="form-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{order.customer_name}</div>
                <div style={{ color: 'var(--text-2)', fontSize: 12 }}>{order.address}</div>
              </div>
              <span className={`badge ${cancelled ? 'red' : order.status === 'Delivered' ? 'green' : 'blue'}`}>
                {order.status}
              </span>
            </div>

            {order.lat != null && <LocationMap lat={order.lat} lng={order.lng} height={190} />}

            <div className="track-eta">
              <span className="track-eta-icon">{cancelled ? '❌' : '🚚'}</span>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-2)' }}>Expected delivery</div>
                <strong>{cancelled ? 'Order cancelled' : eta}</strong>
              </div>
            </div>
          </div>

          <div className="form-card">
            <h3 style={{ fontSize: 16, marginBottom: 14 }}>Delivery progress</h3>
            {!cancelled ? (
              <div className="track-steps">
                {FLOW.map((step, i) => (
                  <div key={step} className={`track-step ${i <= stageIndex ? 'done' : ''}`}>
                    <span className="track-dot">{STAGE_ICON[step]}</span>
                    <div className="track-step-body">
                      <strong>{step}</strong>
                      <span>{i <= stageIndex ? 'Completed' : 'Pending'}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="issue-warn">
                This order was cancelled. Any amount paid is refunded within 3-5 working days.
              </div>
            )}

            <div className="track-wa-row">
              <a
                className="btn-wa"
                href={whatsappUrl}
                target="_blank"
                rel="noreferrer"
                data-testid="whatsapp-order"
              >
                <span>💬</span> Get updates on WhatsApp
              </a>
              <Link className="btn-blue" to={`/order-success/${order.order_no}`}>
                VIEW BILL
              </Link>
            </div>
          </div>

          <div className="form-card">
            <h3 style={{ fontSize: 16, marginBottom: 4 }}>Activity ({activity.length})</h3>
            <p style={{ color: 'var(--text-2)', fontSize: 12, marginBottom: 14 }}>
              Every update logged against this order.
            </p>

            <div className="timeline">
              {activity.map((e) => (
                <div key={e.id} className={`timeline-item ${e.source}`}>
                  <span className="timeline-dot">{STAGE_ICON[e.status] || '•'}</span>
                  <div className="timeline-body">
                    <div className="timeline-head">
                      <strong>{e.title}</strong>
                      <span className="timeline-time">{e.created_at.replace('T', ' ')}</span>
                    </div>
                    <p>{e.note || STAGE_NOTE[e.status]}</p>
                    <span className="timeline-source">
                      {e.source === 'admin' ? 'Store team'
                        : e.source === 'customer' ? 'You' : 'System'}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {user ? (
              <form onSubmit={submitNote} style={{ marginTop: 18 }}>
                <h4 style={{ fontSize: 14, marginBottom: 8 }}>Add a request for this order</h4>
                <div className="field">
                  <input
                    value={note.title}
                    onChange={(e) => setNote({ ...note, title: e.target.value })}
                    placeholder="e.g. Please call before delivery"
                  />
                </div>
                <div className="field">
                  <textarea
                    rows="2"
                    value={note.note}
                    onChange={(e) => setNote({ ...note, note: e.target.value })}
                    placeholder="Extra details (optional)"
                  />
                </div>
                <button className="btn-blue" type="submit" disabled={noteBusy}>
                  {noteBusy ? 'Adding...' : 'ADD REQUEST'}
                </button>
              </form>
            ) : (
              <div className="free-hint" style={{ marginTop: 16 }}>
                <Link to="/login" style={{ color: 'var(--blue)' }}>Login</Link> to add a request or
                delivery instruction for this order.
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="price-box">
            <div className="price-row">
              <span>Items</span>
              <span>{order.items.reduce((a, i) => a + i.qty, 0)}</span>
            </div>
            <div className="price-row">
              <span>Item total</span>
              <span>{formatINR(order.subtotal)}</span>
            </div>
            <div className="price-row">
              <span>Delivery</span>
              <span>{order.delivery_fee > 0 ? formatINR(order.delivery_fee) : 'FREE'}</span>
            </div>
            <div className="price-row total">
              <span>Order total</span>
              <span>{formatINR(order.total)}</span>
            </div>
            <a
              className="btn-green"
              style={{ display: 'block', textAlign: 'center' }}
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
            >
              💬 SHARE ON WHATSAPP
            </a>
          </div>

          <div className="price-box" style={{ marginTop: 14 }}>
            <h4 style={{ fontSize: 14, marginBottom: 10 }}>Items in this order</h4>
            {order.items.map((i) => (
              <div key={i.slug} className="price-row">
                <span>
                  {i.name} <em style={{ color: 'var(--text-2)' }}>× {i.qty}</em>
                </span>
                <span>{formatINR(i.price * i.qty)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
