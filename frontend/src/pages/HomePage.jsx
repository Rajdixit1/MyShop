import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import BannerCarousel from '../components/BannerCarousel'
import CategoryStrip from '../components/CategoryStrip'
import ProductCard from '../components/ProductCard'

function useCountdown(seconds) {
  const [left, setLeft] = useState(seconds)
  useEffect(() => {
    const id = setInterval(() => setLeft((s) => (s > 0 ? s - 1 : seconds)), 1000)
    return () => clearInterval(id)
  }, [seconds])
  const h = String(Math.floor(left / 3600)).padStart(2, '0')
  const m = String(Math.floor((left % 3600) / 60)).padStart(2, '0')
  const s = String(left % 60).padStart(2, '0')
  return { h, m, s }
}

function DealTimer() {
  const { h, m, s } = useCountdown(12 * 3600)
  return (
    <div className="timer">
      Ends in
      <span className="timer-box">{h}H</span>:<span className="timer-box">{m}M</span>
      :<span className="timer-box">{s}S</span>
    </div>
  )
}

export default function HomePage() {
  const [deals, setDeals] = useState([])
  const [best, setBest] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([api.deals(10), api.bestsellers(12)])
      .then(([d, b]) => {
        setDeals(d)
        setBest(b)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <>
      <CategoryStrip />
      <BannerCarousel />

      <div className="container">
        <div className="section">
          <div className="section-head">
            <span className="section-title">Best Deals of the Week</span>
            <DealTimer />
          </div>
          {loading ? (
            <div className="product-row">
              {[...Array(6)].map((_, i) => <div key={i} className="skeleton" style={{ minWidth: 200, flex: '0 0 200px' }} />)}
            </div>
          ) : (
            <div className="product-row">
              {deals.map((p) => <ProductCard key={p.slug} product={p} />)}
            </div>
          )}
        </div>

        <div className="section">
          <div className="section-head">
            <span className="section-title">Top Rated Staples & Essentials</span>
            <Link to="/products" style={{ color: 'var(--blue)', fontWeight: 600 }}>View all →</Link>
          </div>
          {loading ? (
            <div className="grid">
              {[...Array(8)].map((_, i) => <div key={i} className="skeleton" />)}
            </div>
          ) : (
            <div className="grid">
              {best.map((p) => <ProductCard key={p.slug} product={p} />)}
            </div>
          )}
        </div>

        <div className="section">
          <div className="section-head">
            <span className="section-title">Why Shop at Devenand Saw Kirana Store</span>
          </div>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            {[
              ['🚚', 'Free Delivery', 'On all orders above ₹499'],
              ['✅', '100% Original', 'Sealed branded products only'],
              ['↩️', 'Easy Returns', '7 day replacement policy'],
              ['💳', 'Cash on Delivery', 'Pay when your order arrives'],
            ].map(([emoji, title, sub]) => (
              <div key={title} style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                <div className="cat-icon" style={{ width: 54, height: 54, fontSize: 26 }}>{emoji}</div>
                <div>
                  <div style={{ fontWeight: 600 }}>{title}</div>
                  <div style={{ color: 'var(--text-2)', fontSize: 12 }}>{sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}