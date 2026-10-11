import { createContext, useContext, useEffect, useMemo, useReducer, useState } from 'react'
import { api } from '../api'

const CartContext = createContext(null)
const STORAGE_KEY = 'rashan-dukaan-cart-v1'

function loadCart() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((i) => i.slug && i.qty > 0) : []
  } catch {
    return []
  }
}

function reducer(items, action) {
  switch (action.type) {
    case 'add': {
      const { slug, qty = 1 } = action
      const found = items.find((i) => i.slug === slug)
      if (found) {
        return items.map((i) =>
          i.slug === slug ? { ...i, qty: Math.min(20, i.qty + qty) } : i,
        )
      }
      return [...items, { slug, qty }]
    }
    case 'setQty': {
      const { slug, qty } = action
      if (qty <= 0) return items.filter((i) => i.slug !== slug)
      return items.map((i) => (i.slug === slug ? { ...i, qty: Math.min(20, qty) } : i))
    }
    case 'remove':
      return items.filter((i) => i.slug !== action.slug)
    case 'clear':
      return []
    case 'replace':
      return action.items
    default:
      return items
  }
}

export function CartProvider({ children }) {
  const [items, dispatch] = useReducer(reducer, null, loadCart)
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  }, [items])

  // Prices always come from the server - the browser never decides them.
  useEffect(() => {
    let cancelled = false
    if (items.length === 0) {
      setSummary(null)
      return
    }
    setLoading(true)
    api
      .validateCart(items.map(({ slug, qty }) => ({ slug, qty })))
      .then((data) => {
        if (cancelled) return
        setSummary(data)
        const serverItems = data.items.map((li) => ({ slug: li.product.slug, qty: li.qty }))
        const changed =
          serverItems.length !== items.length ||
          serverItems.some((si) => {
            const local = items.find((i) => i.slug === si.slug)
            return !local || local.qty !== si.qty
          })
        if (changed) dispatch({ type: 'replace', items: serverItems })
      })
      .catch(() => {
        if (!cancelled) setSummary(null)
      })
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [items])

  const value = useMemo(
    () => ({
      items,
      summary,
      loading,
      count: summary?.item_count ?? items.reduce((a, i) => a + i.qty, 0),
      add: (slug, qty = 1) => dispatch({ type: 'add', slug, qty }),
      setQty: (slug, qty) => dispatch({ type: 'setQty', slug, qty }),
      remove: (slug) => dispatch({ type: 'remove', slug }),
      clear: () => dispatch({ type: 'clear' }),
      qtyOf: (slug) => items.find((i) => i.slug === slug)?.qty ?? 0,
    }),
    [items, summary, loading],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used inside CartProvider')
  return ctx
}