import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { api, formatINR } from '../api'
import LocationMap from '../components/LocationMap'

export default function OrderSuccess() {
  const { orderNo } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const [order, setOrder] = useState(location.state?.order || null)
  const [whatsapp, setWhatsapp] = useState('')

  useEffect(() => {
    if (order) return
    api
      .order(orderNo)
      .then(setOrder)
      .catch(() => navigate('/'))
  }, [order, orderNo, navigate])

  // the tracking endpoint returns the WhatsApp deep link for this order
  useEffect(() => {
    api
      .trackOrder(orderNo)
      .then((t) => setWhatsapp(t.whatsapp_url))
      .catch(() => setWhatsapp(''))
  }, [orderNo])

  if (!order) return <div className="spinner" />

  return (
    <div className="container">
      <div className="success-box" style={{ marginTop: 12 }}>
        <div className="success-icon">✓</div>
        <h2 style={{ fontSize: 22, marginBottom: 6 }}>Order Confirmed!</h2>
        <p style={{ color: 'var(--text-2)' }}>
          Thank you {order.customer_name}, your groceries are on the way.
        </p>
        <div className="order-no">Order Number: {order.order_no}</div>

        <div style={{ textAlign: 'left', maxWidth: 460, margin: '0 auto 22px' }}>
          <div className="price-row">
            <span>Delivering to</span>
            <span style={{ maxWidth: 260, textAlign: 'right' }}>{order.address}</span>
          </div>
          <div className="price-row">
            <span>Payment method</span>
            <span>{order.payment_method}</span>
          </div>
          <div className="price-row">
            <span>Items</span>
            <span>{order.items.reduce((a, i) => a + i.qty, 0)}</span>
          </div>
          <div className="price-row">
            <span>Delivery</span>
            <span className={order.delivery_fee === 0 ? 'free' : ''}>
              {order.delivery_fee === 0 ? 'FREE' : formatINR(order.delivery_fee)}
            </span>
          </div>
          <div className="price-row total">
            <span>Paid on delivery</span>
            <span>{formatINR(order.total)}</span>
          </div>
        </div>

        {order.lat != null && (
          <div style={{ maxWidth: 460, margin: '0 auto 20px', textAlign: 'left' }}>
            <LocationMap lat={order.lat} lng={order.lng} height={190} />
          </div>
        )}

        <div style={{ maxWidth: 460, margin: '0 auto', textAlign: 'left' }}>
          {order.items.map((item) => (
            <div key={item.slug} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13 }}>
              <span>{item.name} <span style={{ color: 'var(--text-2)' }}>× {item.qty}</span></span>
              <span>₹{(item.price * item.qty).toFixed(0)}</span>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 20, flexWrap: 'wrap' }}>
          <button className="btn-blue" onClick={() => navigate('/products')}>CONTINUE SHOPPING</button>
          <button className="btn-green" onClick={() => navigate('/')}>GO TO HOME</button>
        </div>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 12, flexWrap: 'wrap' }}>
          <button
            className="btn-blue"
            data-testid="track-order-btn"
            onClick={() => navigate(`/track/${order.order_no}`)}
          >
            📍 TRACK ORDER
          </button>
          <a
            className="btn-wa"
            href={whatsapp}
            target="_blank"
            rel="noreferrer"
            data-testid="whatsapp-success"
          >
            💬 ORDER ON WHATSAPP
          </a>
        </div>
      </div>
    </div>
  )
}