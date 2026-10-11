import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, formatINR } from '../api'
import ProductImage from './ProductImage'

const TYPE_ICON = { product: '🛍️', category: '📂', brand: '🏷️' }

/**
 * Debounced type-ahead search box. Suggests products, categories and brands
 * while the shopper types, and supports arrow-key + Enter navigation.
 */
export default function SearchBox({ initial = '' }) {
  const [q, setQ] = useState(initial)
  const [items, setItems] = useState([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [loading, setLoading] = useState(false)
  const boxRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    setQ(initial)
  }, [initial])

  // debounce so we do not fire a request on every keystroke
  useEffect(() => {
    const term = q.trim()
    if (term.length < 1) {
      setItems([])
      setLoading(false)
      return undefined
    }
    setLoading(true)
    const timer = setTimeout(() => {
      api
        .suggest(term)
        .then((res) => setItems(res.suggestions))
        .catch(() => setItems([]))
        .finally(() => setLoading(false))
    }, 220)
    return () => clearTimeout(timer)
  }, [q])

  // close when clicking outside
  useEffect(() => {
    const onClick = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const go = (item) => {
    setOpen(false)
    if (item.type === 'category') navigate(`/category/${item.slug}`)
    else if (item.type === 'product') navigate(`/product/${item.slug}`)
    else navigate(`/search?q=${encodeURIComponent(item.label)}`)
  }

  const submit = (e) => {
    e?.preventDefault()
    if (active >= 0 && items[active]) {
      go(items[active])
      return
    }
    setOpen(false)
    navigate(q.trim() ? `/search?q=${encodeURIComponent(q.trim())}` : '/')
  }

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setActive((i) => (items.length ? (i + 1) % items.length : -1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => (items.length ? (i - 1 + items.length) % items.length : -1))
    } else if (e.key === 'Escape') {
      setOpen(false)
      setActive(-1)
    }
  }

  const showList = open && (loading || items.length > 0)

  return (
    <div className="search-wrap" ref={boxRef}>
      <form onSubmit={submit}>
        <input
          id="search-input"
          value={q}
          onChange={(e) => { setQ(e.target.value); setActive(-1); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search for products, brands and categories"
          aria-label="Search products"
          autoComplete="off"
          role="combobox"
          aria-expanded={showList}
          aria-controls="search-suggestions"
        />
        <button className="search-btn" type="submit" aria-label="Search">🔍</button>
      </form>

      {showList && (
        <div className="suggest-box" id="search-suggestions" role="listbox">
          {loading && items.length === 0 && (
            <div className="suggest-empty">Searching...</div>
          )}

          {!loading && items.length === 0 && (
            <div className="suggest-empty">
              No matches for &ldquo;{q.trim()}&rdquo;
            </div>
          )}

          {items.map((item, i) => (
            <button
              key={`${item.type}-${item.slug || item.label}-${i}`}
              type="button"
              role="option"
              aria-selected={i === active}
              className={`suggest-row ${i === active ? 'active' : ''}`}
              onMouseEnter={() => setActive(i)}
              onClick={() => go(item)}
            >
              {item.type === 'product' ? (
                <span className="suggest-emoji" style={{ background: item.color }}>
                  <ProductImage
                    imageUrl={item.image_url}
                    emoji={item.emoji}
                    alt={item.label}
                    className="thumb-img"
                  />
                </span>
              ) : (
                <span className="suggest-emoji suggest-plain">{TYPE_ICON[item.type]}</span>
              )}

              <span className="suggest-text">
                <span className="suggest-label">{item.label}</span>
                <span className="suggest-sub">{item.sublabel}</span>
              </span>

              {item.type === 'product' ? (
                <span className="suggest-price">
                  <strong>{formatINR(item.price)}</strong>
                  <del>{formatINR(item.mrp)}</del>
                  {!item.in_stock && <em className="suggest-oos">Out of stock</em>}
                </span>
              ) : (
                <span className="suggest-type">{item.type}</span>
              )}
            </button>
          ))}

          {items.length > 0 && (
            <button type="button" className="suggest-all" onClick={submit}>
              See all results for &ldquo;{q.trim()}&rdquo;
            </button>
          )}
        </div>
      )}
    </div>
  )
}