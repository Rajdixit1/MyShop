// Same-origin by default. Set VITE_API_BASE to point the client at a different
// host (e.g. when the frontend is on Netlify and the API on PythonAnywhere).
const BASE = import.meta.env?.VITE_API_BASE || '/api'

/**
 * Two independent sessions: the customer session and the store-admin session.
 * They are kept apart so that validating one never clears or overwrites the other.
 */
const USER_TOKEN_KEY = 'rashan-user-token'
const ADMIN_TOKEN_KEY = 'rashan-admin-token'

let userToken = localStorage.getItem(USER_TOKEN_KEY) || ''
let adminToken = localStorage.getItem(ADMIN_TOKEN_KEY) || ''

export function setUserToken(token) {
  userToken = token || ''
  if (token) localStorage.setItem(USER_TOKEN_KEY, token)
  else localStorage.removeItem(USER_TOKEN_KEY)
}

export function setAdminToken(token) {
  adminToken = token || ''
  if (token) localStorage.setItem(ADMIN_TOKEN_KEY, token)
  else localStorage.removeItem(ADMIN_TOKEN_KEY)
}

export const hasUserToken = () => Boolean(userToken)
export const hasAdminToken = () => Boolean(adminToken)

async function request(path, options = {}, token = '') {
  const { body, ...rest } = options
  // let the browser set the multipart boundary itself when sending FormData
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData
  const res = await fetch(BASE + path, {
    ...rest,
    body,
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
  if (!res.ok) {
    let detail = `Request failed (${res.status})`
    try {
      const data = await res.json()
      detail = data.detail || detail
    } catch {
      /* ignore */
    }
    throw new Error(detail)
  }
  // 204 has no body - parsing it as JSON would throw
  if (res.status === 204 || res.headers.get('content-length') === '0') return null
  return res.json()
}

const asUser = (path, options) => request(path, options, userToken)
const asAdmin = (path, options) => request(path, options, adminToken)

const qs = (params) => {
  const s = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') s.append(k, v)
  })
  const str = s.toString()
  return str ? `?${str}` : ''
}

export const api = {
  categories: () => request('/categories'),
  brands: () => request('/brands'),
  priceRange: () => request('/price-range'),
  products: (params) => request(`/products${qs(params)}`),
  product: (slug) => request(`/products/${slug}`),
  related: (slug, limit = 8) => request(`/products/${slug}/related${qs({ limit })}`),
  deals: (limit = 10) => request(`/deals${qs({ limit })}`),
  bestsellers: (limit = 10) => request(`/bestsellers${qs({ limit })}`),
  validateCart: (items) =>
    request('/cart/validate', { method: 'POST', body: JSON.stringify({ items }) }),
  // Login is compulsory: the order is always attached to the customer account.
  createOrder: (payload) =>
    asUser('/orders', { method: 'POST', body: JSON.stringify(payload) }),
  order: (orderNo) => request(`/orders/${orderNo}`),
  trackOrder: (orderNo) => request(`/orders/${orderNo}/track`),
  addresses: () => asUser('/auth/addresses'),
  saveAddress: (payload) =>
    asUser('/auth/addresses', { method: 'POST', body: JSON.stringify(payload) }),
  deleteAddress: (id) => asUser(`/auth/addresses/${id}`, { method: 'DELETE' }),
  // reverse geocode: exact pin -> readable address (OpenStreetMap Nominatim)
  reverseGeocode: (lat, lng) =>
    request(`/geo/reverse${qs({ lat, lng })}`),
  addOrderNote: (orderNo, payload) =>
    asUser(`/orders/${orderNo}/events`, { method: 'POST', body: JSON.stringify(payload) }),
  supportWhatsapp: () => request('/support/whatsapp'),

  // search suggestions (type-ahead)
  suggest: (q, limit = 8) => asUser(`/products/suggest${qs({ q, limit })}`),

  // auth (customer session)
  register: (payload) =>
    asUser('/auth/register', { method: 'POST', body: JSON.stringify(payload) }),
  login: (payload) => asUser('/auth/login', { method: 'POST', body: JSON.stringify(payload) }),
  me: () => asUser('/auth/me'),
  myOrders: () => asUser('/orders/mine'),

  // admin (separate admin session)
  adminLogin: (payload) =>
    asAdmin('/admin/login', { method: 'POST', body: JSON.stringify(payload) }),
  adminStats: () => asAdmin('/admin/stats'),
  adminProducts: (q) => asAdmin(`/admin/products${qs({ q })}`),
  adminCreateProduct: (payload) =>
    asAdmin('/admin/products', { method: 'POST', body: JSON.stringify(payload) }),
  adminUpdateProduct: (slug, payload) =>
    asAdmin(`/admin/products/${slug}`, { method: 'PUT', body: JSON.stringify(payload) }),
  adminDeleteProduct: (slug) => asAdmin(`/admin/products/${slug}`, { method: 'DELETE' }),
  // multipart upload - the browser sends the file itself, so no manual FormData
  adminUploadImage: (file) => {
    const body = new FormData()
    body.append('file', file)
    return request('/admin/upload', { method: 'POST', body }, adminToken)
  },
  adminOrders: (status) => asAdmin(`/admin/orders${qs({ status })}`),
  adminSetOrderStatus: (orderNo, status) =>
    asAdmin(`/admin/orders/${orderNo}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  adminOrderEvents: (orderNo) => asAdmin(`/admin/orders/${orderNo}/events`),
  adminAddEvent: (orderNo, payload) =>
    asAdmin(`/admin/orders/${orderNo}/events`, { method: 'POST', body: JSON.stringify(payload) }),
  adminSearches: () => asAdmin('/admin/searches'),
  adminCustomers: () => asAdmin('/admin/customers'),
}

export function formatINR(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value)
}