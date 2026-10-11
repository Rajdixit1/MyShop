import { useState } from 'react'
import { Link } from 'react-router-dom'
import { formatINR } from '../api'
import { useCart } from '../context/CartContext'
import ProductImage from './ProductImage'

export default function ProductCard({ product }) {
  const { add, qtyOf } = useCart()
  const [justAdded, setJustAdded] = useState(false)
  const inCart = qtyOf(product.slug)

  const onAdd = () => {
    add(product.slug, 1)
    setJustAdded(true)
    setTimeout(() => setJustAdded(false), 1200)
  }

  return (
    <div className="p-card">
      {product.bestseller && <span className="p-tag">Bestseller</span>}
      {!product.bestseller && product.deal && <span className="p-tag">Deal</span>}

      <Link to={`/product/${product.slug}`} className="p-media" style={{ background: product.color }}>
        <ProductImage
          imageUrl={product.image_url}
          emoji={product.emoji}
          alt={product.name}
          className="p-media-img"
        />
      </Link>

      <span className="p-brand">{product.brand}</span>
      <Link to={`/product/${product.slug}`}>
        <div className="p-name">{product.name}</div>
      </Link>
      <div className="p-unit">{product.unit}</div>

      <div>
        <span className={`rating ${product.rating < 4 ? 'low' : ''}`}>
          ★ {product.rating}
          <span className="rating-count">({(product.rating_count / 1000).toFixed(0)}k)</span>
        </span>
      </div>

      <div className="p-price">
        <strong>{formatINR(product.price)}</strong>
        <del>{formatINR(product.mrp)}</del>
        <span className="p-off">{product.discount_percent}% off</span>
      </div>

      {!product.in_stock && <div className="p-stock">Out of stock</div>}

      {inCart > 0 ? (
        <Link to="/cart" className="btn-primary" style={{ background: 'var(--blue)', marginTop: 10 }}>
          {inCart} in cart · Go to cart
        </Link>
      ) : (
        <button
          className="btn-primary"
          style={{ marginTop: 10 }}
          disabled={!product.in_stock}
          onClick={onAdd}
        >
          {justAdded ? '✓ Added' : 'ADD TO CART'}
        </button>
      )}
    </div>
  )
}