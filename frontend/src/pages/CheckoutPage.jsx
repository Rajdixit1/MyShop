import { useCallback, useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { PriceBreakdown } from './CartPage'
import { useCart } from '../context/CartContext'
import { useAuth } from '../context/AuthContext'
import LocationPicker from '../components/LocationPicker'
import ProductImage from '../components/ProductImage'

const PAYMENTS = [
  { id: 'COD', label: 'Cash on Delivery', emoji: '💵', note: 'Pay in cash when your order arrives' },
  { id: 'UPI', label: 'UPI / Google Pay', emoji: '📱', note: 'Pay using any UPI app (demo only)' },
  { id: 'CARD', label: 'Credit / Debit Card', emoji: '💳', note: 'Visa, Mastercard and RuPay (demo only)' },
]

export default function CheckoutPage() {
  const { items, summary, clear } = useCart()
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    customer_name: '',
    phone: '',
    address: '',
    payment_method: 'COD',
  })
  const [pin, setPin] = useState(null)
  const [saved, setSaved] = useState([])
  const [geoBusy, setGeoBusy] = useState(false)
  const [geoMsg, setGeoMsg] = useState('')
  const [errors, setErrors] = useState({})
  const [placing, setPlacing] = useState(false)
  const [apiError, setApiError] = useState('')

  // Load the account's saved delivery locations so a returning customer is one tap away.
  useEffect(() => {
    if (!user) return
    api.addresses().then(setSaved).catch(() => setSaved([]))
  }, [user])

  // Pre-fill the form from the last used address on the account.
  useEffect(() => {
    if (!user || form.customer_name) return
    setForm((f) => ({
      ...f,
      customer_name: user.name || '',
      phone: user.phone || '',
      address: user.address || '',
    }))
    if (user.address && user.lat != null && user.lng != null) {
      setPin({ lat: user.lat, lng: user.lng, accuracy: null })
    }
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  // Login is compulsory before an order can be placed. The cart survives the
  // redirect because it lives in localStorage, so we land back on /checkout.
  if (!loading && !user) {
    return <Navigate to="/login?next=/checkout" replace />
  }

  const set = (key) => (e) => {
    setForm({ ...form, [key]: e.target.value })
    setErrors({ ...errors, [key]: '' })
  }

  /** Fills the form from a saved address and moves the map to its pin. */
  const applySaved = (a) => {
    setForm((f) => ({ ...f, address: a.address }))
    setPin({ lat: a.lat, lng: a.lng, accuracy: null })
    setErrors((e) => ({ ...e, address: '' }))
  }

  /** Saves the current address + pin so it can be reused next time. */
  const storeAddress = async () => {
    if (!pin || form.address.trim().length < 5) {
      setGeoMsg('Enter an address and drop a pin before saving')
      return
    }
    setGeoBusy(true)
    setGeoMsg('')
    try {
      const created = await api.saveAddress({
        label: 'Home',
        address: form.address.trim(),
        lat: pin.lat,
        lng: pin.lng,
        make_default: saved.length === 0,
      })
      setSaved((s) => [created, ...s])
      setGeoMsg('Saved - you can reuse it on your next order')
    } catch (e) {
      setGeoMsg(e.message)
    } finally {
      setGeoBusy(false)
    }
  }

  /**
   * Returns the address text to store: what the shopper typed, or - when they only
   * dropped a pin - the street address for those coordinates.
   */
  const resolveAddress = useCallback(async () => {
    const typed = form.address.trim()
    if (!pin || typed.length >= 5) return typed
    try {
      const info = await api.reverseGeocode(pin.lat, pin.lng)
      if (info.address) {
        setForm((f) => ({ ...f, address: info.address }))
        return info.address
      }
    } catch {
      /* offline - fall back to the coordinates below */
    }
    return typed || `${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}`
  }, [pin, form.address])

  const validate = () => {
    const next = {}
    if (form.customer_name.trim().length < 2) next.customer_name = 'Please enter your full name'
    if (!/^[0-9]{10}$/.test(form.phone.trim())) next.phone = 'Enter a valid 10 digit mobile number'
    if (form.address.trim().length < 5 && !pin) next.address = 'Please enter your full delivery address'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const placeOrder = async () => {
    // Re-check the session in case it expired while the page was open.
    if (!user) {
      navigate('/login?next=/checkout', { replace: true })
      return
    }
    if (!validate()) return
    setPlacing(true)
    setApiError('')
    try {
      const address = await resolveAddress()
      const order = await api.createOrder({
        customer_name: form.customer_name.trim(),
        phone: form.phone.trim(),
        address,
        payment_method: form.payment_method,
        lat: pin?.lat ?? null,
        lng: pin?.lng ?? null,
        accuracy: pin?.accuracy ?? null,
        items: items.map(({ slug, qty }) => ({ slug, qty })),
      })
      clear()
      navigate(`/order-success/${order.order_no}`, { state: { order } })
    } catch (e) {
      setApiError(e.message)
      setPlacing(false)
      // A rejected session sends the shopper back to login to continue.
      if (/login/i.test(e.message)) navigate('/login?next=/checkout', { replace: true })
    }
  }

  if (items.length === 0 || !summary) {
    return (
      <div className="container">
        <div className="empty">
          <div className="empty-emoji">🛒</div>
          <h3>Nothing to checkout</h3>
          <p>Your cart is empty. Add some groceries first.</p>
          <button className="btn-blue" onClick={() => navigate('/products')}>SHOP NOW</button>
        </div>
      </div>
    )
  }
return (
    <div className="container">
      <div className="list-head" style={{ marginTop: 12 }}>
        <span className="list-title">Delivery Address</span>
      </div>

      <div className="cart-layout">
        <div>
          <div className="form-card">
            <h3 style={{ fontSize: 15, marginBottom: 14 }}>Shipping Details</h3>
            <div className="form-row">
              <div className="field">
                <label htmlFor="name">Full Name</label>
                <input id="name" value={form.customer_name} onChange={set('customer_name')} placeholder="e.g. Sunil Kumar" />
                {errors.customer_name && <div className="err">{errors.customer_name}</div>}
              </div>
              <div className="field">
                <label htmlFor="phone">Mobile Number</label>
                <input id="phone" value={form.phone} onChange={set('phone')} placeholder="10 digit mobile number" maxLength={10} />
                {errors.phone && <div className="err">{errors.phone}</div>}
              </div>
            </div>
            <div className="field">
              <label htmlFor="address">Complete Address</label>
              <textarea
                id="address"
                rows="3"
                value={form.address}
                onChange={set('address')}
                placeholder="House / Flat, Street, Area, City, PIN code"
              />
              {errors.address && <div className="err">{errors.address}</div>}
            </div>

            {saved.length > 0 && (
              <div className="field">
                <label>Saved addresses</label>
                <div className="geo-saved">
                  {saved.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      className="geo-chip"
                      data-testid="saved-address"
                      onClick={() => applySaved(a)}
                    >
                      <strong>{a.label}</strong>
                      <span>{a.address}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <LocationPicker value={pin} onChange={setPin} />

            <div className="geo-save-row">
              <button
                type="button"
                className="link-btn"
                onClick={storeAddress}
                disabled={geoBusy}
                data-testid="save-address-btn"
              >
                {geoBusy ? 'SAVING...' : 'SAVE THIS ADDRESS'}
              </button>
              {geoMsg && <span className="geo-msg">{geoMsg}</span>}
            </div>

            <h3 style={{ fontSize: 15, margin: '22px 0 12px' }}>Payment Method</h3>
            {PAYMENTS.map((p) => (
              <div
                key={p.id}
                className={`pay-option ${form.payment_method === p.id ? 'sel' : ''}`}
                onClick={() => setForm({ ...form, payment_method: p.id })}
              >
                <input
                  type="radio"
                  checked={form.payment_method === p.id}
                  onChange={() => setForm({ ...form, payment_method: p.id })}
                  aria-label={p.label}
                />
                <span style={{ fontSize: 20 }}>{p.emoji}</span>
                <div>
                  <div style={{ fontWeight: 600 }}>{p.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-2)' }}>{p.note}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="form-card" style={{ marginTop: 12 }}>
            <h3 style={{ fontSize: 15, marginBottom: 12 }}>Order Items ({summary.item_count})</h3>
            {summary.items.map((line) => (
              <div key={line.product.slug} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '8px 0' }}>
                <div
                  className="cart-media"
                  style={{ width: 48, height: 48, fontSize: 24, background: line.product.color, flex: '0 0 48px' }}
                >
                  <ProductImage
                    imageUrl={line.product.image_url}
                    emoji={line.product.emoji}
                    alt={line.product.name}
                    className="thumb-img"
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13 }}>{line.product.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
                    {line.product.unit} × {line.qty}
                  </div>
                </div>
                <strong style={{ fontSize: 14 }}>₹{line.line_total.toFixed(0)}</strong>
              </div>
            ))}
          </div>
        </div>

        <div>
          <PriceBreakdown summary={summary} checkout disabled={placing} onClick={placeOrder} />
          {apiError && <div className="error-box" style={{ marginTop: 12 }}>{apiError}</div>}
        </div>
      </div>
    </div>
  )
}