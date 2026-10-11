import { useCallback, useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import CategoryStrip from '../components/CategoryStrip'
import ProductCard from '../components/ProductCard'

const SORTS = [
  ['popularity', 'Popularity'],
  ['price_low', 'Price -- Low to High'],
  ['price_high', 'Price -- High to Low'],
  ['rating', 'Rating'],
  ['discount', 'Discount'],
]

const RATINGS = [
  [4, '4★ & Above'],
  [3.5, '3.5★ & Above'],
  [3, '3★ & Above'],
]

export default function ProductListing({ title }) {
  const [params, setParams] = useSearchParams()
  const { slug } = useParams()
  const [data, setData] = useState(null)
  const [brands, setBrands] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const q = params.get('q') || ''
  // category can come from the route (/category/:slug) or the query string
  const category = slug || params.get('category') || ''
  const sort = params.get('sort') || 'popularity'
  const page = Number(params.get('page') || 1)
  const minPrice = params.get('min_price') || ''
  const maxPrice = params.get('max_price') || ''
  const minRating = params.get('min_rating') || ''
  const brandParam = params.get('brands') || ''
  const selectedBrands = brandParam ? brandParam.split(',') : []

  const update = (changes) => {
    const next = new URLSearchParams(params)
    Object.entries(changes).forEach(([k, v]) => {
      if (v === '' || v === null || v === undefined) next.delete(k)
      else next.set(k, v)
    })
    if (!('page' in changes)) next.delete('page')
    setParams(next)
  }

  const toggleBrand = (brand) => {
    const next = selectedBrands.includes(brand)
      ? selectedBrands.filter((b) => b !== brand)
      : [...selectedBrands, brand]
    update({ brands: next.join(',') })
  }

  useEffect(() => {
    api.brands().then(setBrands).catch(() => {})
  }, [])

  const load = useCallback(() => {
    setLoading(true)
    setError('')
    api
      .products({
        q,
        category,
        sort,
        page,
        page_size: 12,
        brands: brandParam,
        min_price: minPrice,
        max_price: maxPrice,
        min_rating: minRating,
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [q, category, sort, page, brandParam, minPrice, maxPrice, minRating])

  useEffect(() => {
    load()
  }, [load])

  const chipList = [
    ...(q ? [{ key: `q-${q}`, label: `Search: ${q}`, clear: () => update({ q: '' }) }] : []),
    ...selectedBrands.map((b) => ({ key: `b-${b}`, label: b, clear: () => toggleBrand(b) })),
    ...(minPrice || maxPrice
      ? [{
          key: 'price',
          label: `₹${minPrice || 0} - ₹${maxPrice || '∞'}`,
          clear: () => update({ min_price: '', max_price: '' }),
        }]
      : []),
    ...(minRating
      ? [{ key: 'rate', label: `${minRating}★ & above`, clear: () => update({ min_rating: '' }) }]
      : []),
  ]

  const heading =
    title ||
    (q
      ? `Results for "${q}"`
      : category
        ? category.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
        : 'All Grocery Products')

  return (
    <>
      {category && <CategoryStrip active={category} />}

      <div className="container listing">
        <aside className="filters">
          <div className="filter-title" style={{ color: 'var(--text)' }}>FILTERS</div>
          {chipList.length > 0 && (
            <button
              className="link-btn"
              style={{ color: 'var(--blue)', marginBottom: 10 }}
              onClick={() => setParams(category ? { category } : {})}
            >
              Clear all
            </button>
          )}

          <div className="filter-group">
            <div className="filter-title">Price</div>
            <div className="price-inputs">
              <input
                type="number"
                placeholder="Min"
                value={minPrice}
                onChange={(e) => update({ min_price: e.target.value })}
                aria-label="Minimum price"
              />
              <span>—</span>
              <input
                type="number"
                placeholder="Max"
                value={maxPrice}
                onChange={(e) => update({ max_price: e.target.value })}
                aria-label="Maximum price"
              />
            </div>
            <div style={{ marginTop: 10 }}>
              {[100, 250, 500].map((limit) => (
                <label key={limit} className="filter-row">
                  <input
                    type="checkbox"
                    checked={maxPrice === String(limit)}
                    onChange={(e) =>
                      update({ min_price: '', max_price: e.target.checked ? String(limit) : '' })
                    }
                  />
                  Below ₹{limit}
                </label>
              ))}
            </div>
          </div>

          <div className="filter-group">
            <div className="filter-title">Brand</div>
            {brands.map((b) => (
              <label key={b} className="filter-row">
                <input
                  type="checkbox"
                  checked={selectedBrands.includes(b)}
                  onChange={() => toggleBrand(b)}
                />
                {b}
              </label>
            ))}
          </div>

          <div className="filter-group">
            <div className="filter-title">Customer Rating</div>
            {RATINGS.map(([value, label]) => (
              <label key={value} className="filter-row">
                <input
                  type="radio"
                  name="rating"
                  checked={minRating === String(value)}
                  onChange={() =>
                    update({ min_rating: minRating === String(value) ? '' : String(value) })
                  }
                />
                {label}
              </label>
            ))}
          </div>
        </aside>

        <main>
          <div className="list-head">
            <span className="list-title">
              {heading} <span>({data ? data.total : 0} products)</span>
            </span>
            <select
              className="sort-select"
              value={sort}
              onChange={(e) => update({ sort: e.target.value })}
              aria-label="Sort products"
            >
              {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>

          {chipList.length > 0 && (
            <div className="active-chips">
              {chipList.map((c) => (
                <span key={c.key} className="chip">
                  {c.label}
                  <button onClick={c.clear} aria-label={`Remove ${c.label}`}>×</button>
                </span>
              ))}
            </div>
          )}

          {error && <div className="error-box">Something went wrong: {error}</div>}

          {loading ? (
            <div className="grid">
              {[...Array(12)].map((_, i) => <div key={i} className="skeleton" />)}
            </div>
          ) : data && data.items.length === 0 ? (
            <div className="empty">
              <div className="empty-emoji">🔍</div>
              <h3>No products found</h3>
              <p>Try removing some filters or search for something else.</p>
              <button className="btn-blue" onClick={() => setParams({})}>Clear all filters</button>
            </div>
          ) : (
            <div className="grid">
              {data.items.map((p) => <ProductCard key={p.slug} product={p} />)}
            </div>
          )}

          {data && data.pages > 1 && (
            <div className="pager">
              <button onClick={() => update({ page: page - 1 })} disabled={page <= 1}>‹</button>
              {Array.from({ length: data.pages }, (_, i) => i + 1)
                .filter((n) => n === 1 || n === data.pages || Math.abs(n - page) <= 2)
                .map((n, idx, arr) => (
                  <span key={n} style={{ display: 'flex', gap: 6 }}>
                    {idx > 0 && arr[idx - 1] !== n - 1 && <button disabled>…</button>}
                    <button className={n === page ? 'active' : ''} onClick={() => update({ page: n })}>
                      {n}
                    </button>
                  </span>
                ))}
              <button onClick={() => update({ page: page + 1 })} disabled={page >= data.pages}>›</button>
            </div>
          )}
        </main>
      </div>
    </>
  )
}