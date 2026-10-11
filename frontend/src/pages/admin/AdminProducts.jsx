import { useCallback, useEffect, useState } from 'react'
import { api, formatINR } from '../../api'
import ProductModal, { emptyForm, formFromProduct, formToPayload } from './ProductModal'
import ProductImage from '../../components/ProductImage'

export default function AdminProducts() {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(null)   // product object, or 'new'
  const [form, setForm] = useState(() => emptyForm([]))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      setProducts(await api.adminProducts())
    } catch (e) {
      setError(e.message)
    }
  }, [])

  useEffect(() => {
    load()
    api.categories().then(setCategories).catch(() => {})
  }, [load])

  const openNew = () => {
    setForm(emptyForm(categories))
    setError('')
    setEditing('new')
  }

  const openEdit = (p) => {
    setForm(formFromProduct(p))
    setError('')
    setEditing(p)
  }

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      const payload = formToPayload(form)
      if (editing === 'new') await api.adminCreateProduct(payload)
      else await api.adminUpdateProduct(editing.slug, payload)
      setEditing(null)
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const remove = async (p) => {
    if (!window.confirm(`Delete "${p.name}"? This cannot be undone.`)) return
    try {
      await api.adminDeleteProduct(p.slug)
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  const visible = products.filter((p) => {
    const t = search.toLowerCase()
    return !t || p.name.toLowerCase().includes(t) || p.brand.toLowerCase().includes(t)
  })

  return (
    <>
      <div className="admin-head">
        <h1>Products ({products.length})</h1>
        <div style={{ display: 'flex', gap: 10 }}>
          <input
            className="sort-select"
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button className="btn-sm green" onClick={openNew}>+ Add Product</button>
        </div>
      </div>

      {error && !editing && <div className="error-box">{error}</div>}

      <div className="admin-card">
        <table className="data">
          <thead>
            <tr>
              <th>Product</th><th>Category</th><th>Price</th><th>Stock</th>
              <th>Rating</th><th>Flags</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((p) => (
              <tr key={p.slug}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="tbl-emoji" style={{ background: p.color }}>
                      <ProductImage
                        imageUrl={p.image_url}
                        emoji={p.emoji}
                        alt={p.name}
                        className="thumb-img"
                      />
                    </span>
                    <div>
                      <div style={{ fontWeight: 500 }}>{p.name}</div>
                      <div style={{ color: 'var(--text-2)', fontSize: 12 }}>
                        {p.brand} · {p.unit}
                      </div>
                    </div>
                  </div>
                </td>
                <td>{p.category_name}</td>
                <td>
                  <strong>{formatINR(p.price)}</strong>
                  <div style={{ color: 'var(--text-2)', fontSize: 12 }}>
                    <del>{formatINR(p.mrp)}</del> · {p.discount_percent}% off
                  </div>
                </td>
                <td>
                  <span className={`badge ${p.stock === 0 ? 'red' : p.stock <= 20 ? 'orange' : 'green'}`}>
                    {p.stock === 0 ? 'Out of stock' : p.stock}
                  </span>
                </td>
                <td>★ {p.rating}</td>
                <td>
                  {p.bestseller && <span className="badge green">Bestseller</span>}{' '}
                  {p.deal && <span className="badge blue">Deal</span>}
                </td>
                <td>
                  <button className="btn-sm blue" onClick={() => openEdit(p)}>Edit</button>{' '}
                  <button className="btn-sm red" onClick={() => remove(p)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {visible.length === 0 && (
          <p style={{ padding: 20, textAlign: 'center', color: 'var(--text-2)' }}>
            No products match "{search}".
          </p>
        )}
      </div>

      {editing && (
        <ProductModal
          title={editing === 'new' ? 'Add New Product' : `Edit: ${editing.name}`}
          form={form}
          setForm={setForm}
          categories={categories}
          error={error}
          saving={saving}
          onSave={save}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  )
}