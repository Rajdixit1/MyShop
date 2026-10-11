import { Link, useNavigate } from 'react-router-dom'
import { formatINR } from '../api'
import { useCart } from '../context/CartContext'
import ProductImage from '../components/ProductImage'

export function PriceBreakdown({ summary, checkout = false, disabled, onClick }) {
  const toFree = summary.free_delivery_threshold - summary.subtotal
  const tax = Math.max(
    0,
    summary.order_total - summary.subtotal - summary.delivery_fee - summary.handling_fee,
  )
  return (
    <div className="price-box">
      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-2)', letterSpacing: '.5px', marginBottom: 12 }}>
        PRICE DETAILS
      </div>

      {summary.total_savings > 0 && (
        <div className="saving-box">
          Your Total Savings ₹{summary.total_savings.toLocaleString('en-IN')}
        </div>
      )}

      {summary.issues.map((msg) => <div key={msg} className="issue-warn">{msg}</div>)}

      {toFree > 0 && (
        <div className="free-hint">
          Add <strong>{formatINR(toFree)}</strong> more to get <strong>FREE delivery</strong>
        </div>
      )}

      <div className="price-row">
        <span>Price ({summary.item_count} items)</span>
        <span>{formatINR(summary.mrp_total)}</span>
      </div>
      <div className="price-row">
        <span>Discount</span>
        <span style={{ color: 'var(--green)' }}>− {formatINR(summary.total_savings)}</span>
      </div>
      <div className="price-row">
        <span>Delivery Fee</span>
        <span className={summary.delivery_fee === 0 ? 'free' : ''}>
          {summary.delivery_fee === 0 ? 'FREE' : formatINR(summary.delivery_fee)}
        </span>
      </div>
      <div className="price-row">
        <span>Handling Fee</span>
        <span>{formatINR(summary.handling_fee)}</span>
      </div>
      <div className="price-row">
        <span>GST (5%)</span>
        <span>{formatINR(tax)}</span>
      </div>
      <div className="price-row total">
        <span>Total Amount</span>
        <span>{formatINR(summary.order_total)}</span>
      </div>

      {checkout ? (
        <button
          className="btn-green"
          style={{ width: '100%', marginTop: 14 }}
          disabled={disabled}
          onClick={onClick}
        >
          {disabled ? 'PLACING ORDER...' : 'PLACE ORDER'}
        </button>
      ) : (
        <Link
          to="/checkout"
          className="btn-green"
          style={{ display: 'block', textAlign: 'center', marginTop: 14 }}
        >
          PLACE ORDER
        </Link>
      )}
      <p style={{ fontSize: 12, color: 'var(--text-2)', textAlign: 'center', marginTop: 10 }}>
        Safe and secure payments. Cash on delivery available.
      </p>
    </div>
  )
}

export default function CartPage() {
  const { items, summary, loading, setQty, remove, clear } = useCart()
  const navigate = useNavigate()

  if (items.length === 0) {
    return (
      <div className="container">
        <div className="empty">
          <div className="empty-emoji">🛒</div>
          <h3>Your cart is empty!</h3>
          <p>Add your favourite groceries and shop now.</p>
          <button className="btn-blue" onClick={() => navigate('/products')}>
            SHOP NOW
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="container">
      <div className="list-head" style={{ marginTop: 12 }}>
        <span className="list-title">My Cart ({summary?.item_count ?? items.length})</span>
        <button className="link-btn" onClick={clear}>Clear cart</button>
      </div>

      <div className="cart-layout">
        <div className="form-card">
          {!summary ? (
            <div className="spinner" />
          ) : (
            summary.items.map((line) => (
              <div key={line.product.slug} className="cart-line">
                <Link
                  to={`/product/${line.product.slug}`}
                  className="cart-media"
                  style={{ background: line.product.color }}
                >
                  <ProductImage
                    imageUrl={line.product.image_url}
                    emoji={line.product.emoji}
                    alt={line.product.name}
                    className="media-img"
                  />
                </Link>

                <div>
                  <Link to={`/product/${line.product.slug}`}>
                    <div style={{ fontWeight: 500, fontSize: 15 }}>{line.product.name}</div>
                  </Link>
                  <div className="p-brand" style={{ marginTop: 2 }}>{line.product.brand}</div>
                  <div style={{ marginTop: 8 }}>
                    <strong style={{ fontSize: 17 }}>{formatINR(line.product.price)}</strong>{' '}
                    <del style={{ color: 'var(--text-2)', fontSize: 13 }}>
                      {formatINR(line.product.mrp)}
                    </del>{' '}
                    <span className="p-off">{line.product.discount_percent}% off</span>
                  </div>
                  <div style={{ color: 'var(--text-2)', fontSize: 12, marginTop: 4 }}>
                    {line.product.unit} · {line.product.category_name}
                  </div>

                  <div className="cart-line-actions">
                    <div className="qty-box" style={{ width: 120 }}>
                      <button onClick={() => setQty(line.product.slug, line.qty - 1)} aria-label="Decrease">−</button>
                      <span>{line.qty}</span>
                      <button onClick={() => setQty(line.product.slug, line.qty + 1)} aria-label="Increase">＋</button>
                    </div>
                    <button className="link-btn" onClick={() => remove(line.product.slug)}>REMOVE</button>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 600, fontSize: 17 }}>{formatINR(line.line_total)}</div>
                  {loading && <div style={{ fontSize: 11, color: 'var(--text-2)' }}>updating…</div>}
                </div>
              </div>
            ))
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 14 }}>
            <button className="btn-primary" style={{ width: 220 }} onClick={() => navigate('/products')}>
              CONTINUE SHOPPING
            </button>
          </div>
        </div>

        {summary && <PriceBreakdown summary={summary} />}
      </div>
    </div>
  )
}