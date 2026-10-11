import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api'

export default function CategoryStrip({ active }) {
  const [categories, setCategories] = useState([])
  const navigate = useNavigate()

  useEffect(() => {
    api.categories().then(setCategories).catch(() => setCategories([]))
  }, [])

  return (
    <div className="cat-strip">
      <div className="container">
        <div className="cat-scroll">
          {categories.map((c) => (
            <Link
              key={c.slug}
              to={`/category/${c.slug}`}
              className={`cat-item ${active === c.slug ? 'active' : ''}`}
            >
              <span className="cat-icon" role="img" aria-label={c.name}>{c.icon}</span>
              <span className="cat-name">{c.name}</span>
            </Link>
          ))}
          <button className="cat-item" onClick={() => navigate('/products')}>
            <span className="cat-icon">🛒</span>
            <span className="cat-name">All Products</span>
          </button>
        </div>
      </div>
    </div>
  )
}