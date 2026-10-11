// Product icon choices. Kept as real emoji characters (not escape sequences)
// so they render as pictures in the icon picker.
import { useRef, useState } from 'react'
import { api } from '../../api'
import ProductImage from '../../components/ProductImage'

const EMOJIS = [
  '🌿', '🥬', '🍎', '🥜', '🥔', '🍇',
  '🌶', '🧂', '🍯', '🥛', '🧈', '☕',
  '🍩', '🍪', '🧃', '🍟', '🧴', '🧼',
  '🧻', '🥤',
]

// Kept in step with the backend limits in main.py
const MAX_BYTES = 3 * 1024 * 1024
const ACCEPTED = 'image/jpeg,image/png,image/webp,image/gif'

export function emptyForm(categories) {
  return {
    name: '', brand: '', category: categories[0]?.slug || '', price: '', mrp: '',
    unit: '1 kg', stock: '50', rating: '4.0', emoji: '🌿', image_url: '', color: '#f6e7c8',
    description: '', highlights: '', bestseller: false, deal: false,
  }
}

export function formFromProduct(p) {
  return {
    name: p.name, brand: p.brand, category: p.category, price: p.price, mrp: p.mrp,
    unit: p.unit, stock: p.stock, rating: p.rating, emoji: p.emoji, color: p.color,
    image_url: p.image_url || '',
    description: p.description, highlights: p.highlights.join(', '),
    bestseller: p.bestseller, deal: p.deal,
  }
}

export function formToPayload(form) {
  return {
    name: form.name,
    brand: form.brand,
    category: form.category,
    price: Number(form.price),
    mrp: Number(form.mrp) || Number(form.price),
    unit: form.unit,
    stock: Number(form.stock),
    rating: Number(form.rating) || 4,
    emoji: form.emoji,
    image_url: form.image_url || '',
    color: form.color,
    description: form.description,
    highlights: form.highlights.split(',').map((h) => h.trim()).filter(Boolean),
    bestseller: form.bestseller,
    deal: form.deal,
  }
}

/** Add / edit product form shown in a modal. */
export default function ProductModal({ title, form, setForm, categories, error, saving, onSave, onClose }) {
  const fileRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState('')

  const set = (key) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm({ ...form, [key]: value })
  }

  /** Uploads the chosen photo and stores the returned URL on the form. */
  const pickFile = async (e) => {
    const file = e.target.files?.[0]
    // clear the input so re-picking the same file still fires a change event
    e.target.value = ''
    if (!file) return

    if (file.size > MAX_BYTES) {
      setUploadMsg(`Image is too large - the limit is ${MAX_BYTES / (1024 * 1024)} MB`)
      return
    }
    setUploading(true)
    setUploadMsg('')
    try {
      const res = await api.adminUploadImage(file)
      setForm({ ...form, image_url: res.url })
      setUploadMsg('Image uploaded')
    } catch (err) {
      setUploadMsg(err.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="admin-modal" onClick={onClose}>
      <div className="box" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>

        <div className="form-row">
          <div className="field">
            <label>Product name</label>
            <input value={form.name} onChange={set('name')} placeholder="e.g. Sona Masoor Daal" />
          </div>
          <div className="field">
            <label>Brand</label>
            <input value={form.brand} onChange={set('brand')} placeholder="e.g. Daal Boro" />
          </div>
        </div>

        <div className="form-row">
          <div className="field">
            <label>Category</label>
            <select value={form.category} onChange={set('category')}>
              {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Unit / pack size</label>
            <input value={form.unit} onChange={set('unit')} placeholder="1 kg" />
          </div>
        </div>

        <div className="form-row">
          <div className="field">
            <label>Selling price (₹)</label>
            <input type="number" value={form.price} onChange={set('price')} />
          </div>
          <div className="field">
            <label>MRP (₹)</label>
            <input type="number" value={form.mrp} onChange={set('mrp')} />
          </div>
        </div>

        <div className="form-row">
          <div className="field">
            <label>Stock quantity</label>
            <input type="number" value={form.stock} onChange={set('stock')} />
          </div>
          <div className="field">
            <label>Rating (0-5)</label>
            <input type="number" step="0.1" max="5" value={form.rating} onChange={set('rating')} />
          </div>
        </div>

        <div className="field">
          <label>Product image</label>
          <div className="upload-row">
            <div
              className="upload-preview"
              style={{ background: form.color }}
              data-testid="upload-preview"
            >
              <ProductImage
                imageUrl={form.image_url}
                emoji={form.emoji}
                alt={form.name || 'product'}
              />
            </div>
            <div className="upload-actions">
              <input
                ref={fileRef}
                type="file"
                accept={ACCEPTED}
                onChange={pickFile}
                style={{ display: 'none' }}
                data-testid="upload-input"
              />
              <button
                type="button"
                className="btn-sm grey"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                data-testid="upload-btn"
              >
                {uploading ? 'UPLOADING...' : form.image_url ? 'REPLACE IMAGE' : 'UPLOAD IMAGE'}
              </button>
              {form.image_url && (
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => { setForm({ ...form, image_url: '' }); setUploadMsg('') }}
                >
                  Remove image
                </button>
              )}
              <div className="upload-hint">
                JPG, PNG, WebP or GIF · up to {MAX_BYTES / (1024 * 1024)} MB
              </div>
              {uploadMsg && (
                <div
                  className={uploadMsg === 'Image uploaded' ? 'upload-ok' : 'err'}
                  data-testid="upload-msg"
                >
                  {uploadMsg}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="field">
          <label>Icon (emoji){form.image_url ? ' - used only when no image is set' : ''}</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setForm({ ...form, emoji: e })}
                style={{
                  fontSize: 22, padding: '4px 6px', borderRadius: 4,
                  background: form.emoji === e ? '#e3edff' : '#f5f7fa',
                  border: form.emoji === e ? '2px solid var(--blue)' : '1px solid transparent',
                }}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label>Background colour</label>
          <input type="color" value={form.color} onChange={set('color')}
            style={{ width: 80, height: 36, padding: 2 }} />
        </div>

        <div className="field">
          <label>Description</label>
          <textarea rows="2" value={form.description} onChange={set('description')} />
        </div>

        <div className="field">
          <label>Highlights (comma separated)</label>
          <input value={form.highlights} onChange={set('highlights')}
            placeholder="High Protein, Quick Cook, Unpolished" />
        </div>

        <div style={{ display: 'flex', gap: 20, marginBottom: 10 }}>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="checkbox" checked={form.bestseller} onChange={set('bestseller')} />
            Bestseller
          </label>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="checkbox" checked={form.deal} onChange={set('deal')} />
            Show in Deals
          </label>
        </div>

        {error && <div className="issue-warn">{error}</div>}

        <div className="modal-actions">
          <button className="btn-sm grey" onClick={onClose}>Cancel</button>
          <button className="btn-sm green" onClick={onSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}