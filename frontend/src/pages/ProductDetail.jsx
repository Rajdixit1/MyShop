import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, formatINR } from '../api'
import ProductCard from '../components/ProductCard'
import ProductImage from '../components/ProductImage'
import { useCart } from '../context/CartContext'

export default function ProductDetail() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const { add, qtyOf, summary } = useCart()
  const [product, setProduct] = useState(null)
  const [related, setRelated] = useState([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [qty, setQty] = useState(1)

  useEffect(() => {
    setLoading(true)
    setNotFound(false)
    setQty(1)
    Promise.all([api.product(slug), api.related(slug, 8)])
      .then(([p, r]) => {
        setProduct(p)
        setRelated(r)
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [slug])

  if (loading) return <div className="spinner" />
  if (notFound || !product) {
    return (
      <div className="container">
        <div className="empty" style={{ marginTop: 12 }}>
          <div className="empty-emoji">😕</div>
          <h3>Product not found</h3>
          <p>This product may have been removed from the store.</p>
          <button className="btn-blue" onClick={() => navigate('/products')}>Browse all products</button>
        </div>
      </div>
    )
  }

  const inCart = qtyOf(product.slug)
  const cartQty = summary?.items.find((i) => i.product.slug === product.slug)?.qty ?? 0

  return (
    <div className="container">
      <div className="breadcrumb">
        <Link to="/">Home</Link> ›
        <Link to={`/category/${product.category}`}>{product.category_name}</Link> › {product.name}
      </div>

      <div className="detail-block">
        <div className="detail-grid">
          <div>
            <div className="detail-media" style={{ background: product.color }}>
              <ProductImage
                imageUrl={product.image_url}
                emoji={product.emoji}
                alt={product.name}
                className="detail-media-img"
              />
            </div>
          </div>

          <div>
            <div className="p-brand">{product.brand}</div>
            <h1 className="detail-name">{product.name}</h1>
            <div className="detail-sub">
              {product.unit} · {product.category_name}
            </div>

            <div style={{ margin: '10px 0' }}>
              <span className={`rating ${product.rating < 4 ? 'low' : ''}`}>
                ★ {product.rating}
                <span className="rating-count">
                  {product.rating_count.toLocaleString('en-IN')} Ratings & {product.reviews} Reviews
                </span>
              </span>
            </div>

            <div className="detail-price">
              <strong>{formatINR(product.price)}</strong>
              <del style={{ color: 'var(--text-2)', fontSize: 16 }}>{formatINR(product.mrp)}</del>
              <span className="p-off">{product.discount_percent}% off</span>
            </div>
            <p style={{ color: 'var(--green)', fontWeight: 600, marginBottom: 12 }}>
              Inclusive of all taxes
            </p>

            <p style={{ color: 'var(--text-2)', marginBottom: 16 }}>{product.description}</p>

            {product.in_stock ? (
              product.stock <= 20 && (
                <div className="issue-warn">Hurry! Only {product.stock} left in stock.</div>
              )
            ) : (
              <div className="issue-warn">Out of stock. Please check back later.</div>
            )}

            {inCart > 0 && (
              <div className="saving-box">✓ {inCart} already in your cart</div>
            )}

            <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginTop: 16 }}>
              {product.in_stock && (
                <div className="qty-box" style={{ width: 140 }}>
                  <button onClick={() => setQty((v) => Math.max(1, v - 1))} aria-label="Decrease quantity">−</button>
                  <span>{qty}</span>
                  <button onClick={() => setQty((v) => Math.min(20, v + 1))} aria-label="Increase quantity">＋</button>
                </div>
              )}
              <button
                className="btn-primary"
                style={{ width: 200 }}
                disabled={!product.in_stock}
                onClick={() => add(product.slug, qty)}
              >
                {product.in_stock ? 'ADD TO CART' : 'OUT OF STOCK'}
              </button>
              {inCart > 0 && (
                <button className="btn-blue" onClick={() => navigate('/cart')}>GO TO CART</button>
              )}
            </div>

            {product.highlights.length > 0 && (
              <div style={{ marginTop: 22 }}>
                <h3 style={{ fontSize: 15, marginBottom: 8 }}>Highlights</h3>
                {product.highlights.map((h) => (
                  <div key={h} className="highlight">{h}</div>
                ))}
              </div>
            )}

            <div style={{ marginTop: 22, fontSize: 13, color: 'var(--text-2)', lineHeight: 1.9 }}>
              <div>🚚 Delivers in 2-4 days</div>
              <div>💵 Cash on Delivery available</div>
              <div>↩️ 7 day easy returns</div>
            </div>
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <div className="section">
          <div className="section-head">
            <span className="section-title">Similar Products</span>
          </div>
          <div className="product-row">
            {related.map((p) => <ProductCard key={p.slug} product={p} />)}
          </div>
        </div>
      )}

      <div style={{ height: cartQty >= 0 ? 0 : 0 }} />
    </div>
  )
}