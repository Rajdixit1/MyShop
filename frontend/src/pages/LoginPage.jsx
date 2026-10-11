import { useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// Only same-origin paths are allowed, so ?next cannot be used to redirect elsewhere.
const safeNext = (value) => (/^\/[a-zA-Z0-9/_-]*$/.test(value || '') ? value : '/orders')

export default function LoginPage() {
  const { login, register, user } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ name: '', phone: '', password: '', address: '' })
  const [errors, setErrors] = useState({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // Already signed in - bounce straight back to wherever the shopper was headed.
  if (user) {
    return <Navigate to={safeNext(params.get('next'))} replace />
  }

  const set = (key) => (e) => {
    setForm({ ...form, [key]: e.target.value })
    setErrors({ ...errors, [key]: '' })
  }

  const validate = () => {
    const next = {}
    if (mode === 'register' && form.name.trim().length < 2) next.name = 'Enter your name'
    if (!/^[6-9]\d{9}$/.test(form.phone)) next.phone = 'Enter valid 10 digit mobile number'
    if (form.password.length < 4) next.password = 'Password must be at least 4 characters'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!validate()) return
    setBusy(true)
    setError('')
    try {
      if (mode === 'login') await login(form.phone, form.password)
      else await register({ ...form, phone: form.phone })
      navigate(safeNext(params.get('next')))
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-box" onSubmit={submit}>
        <div style={{ fontSize: 34, marginBottom: 6 }}>🛒</div>
        <h2>{mode === 'login' ? 'Login to your account' : 'Create your account'}</h2>
        <p className="sub">Track orders and checkout faster</p>

        <div className="tabs">
          <button type="button" className={`tab ${mode === 'login' ? 'active' : ''}`}
            onClick={() => { setMode('login'); setError('') }}>Login</button>
          <button type="button" className={`tab ${mode === 'register' ? 'active' : ''}`}
            onClick={() => { setMode('register'); setError('') }}>Register</button>
        </div>

        {mode === 'register' && (
          <div className="field">
            <label htmlFor="reg-name">Full name</label>
            <input id="reg-name" value={form.name} onChange={set('name')} placeholder="e.g. Sunil Kumar" />
            {errors.name && <div className="err">{errors.name}</div>}
          </div>
        )}

        <div className="field">
          <label htmlFor="reg-phone">Mobile number</label>
          <input id="reg-phone" value={form.phone} onChange={set('phone')}
            placeholder="10 digit mobile number" maxLength={10} />
          {errors.phone && <div className="err">{errors.phone}</div>}
        </div>

        <div className="field">
          <label htmlFor="reg-pass">Password</label>
          <input id="reg-pass" type="password" value={form.password} onChange={set('password')}
            placeholder="Minimum 4 characters" />
          {errors.password && <div className="err">{errors.password}</div>}
        </div>

        {mode === 'register' && (
          <div className="field">
            <label htmlFor="reg-addr">Delivery address (optional)</label>
            <textarea id="reg-addr" rows="2" value={form.address} onChange={set('address')}
              placeholder="House / street / city / PIN" />
          </div>
        )}

        {error && <div className="issue-warn">{error}</div>}

        <button className="btn-primary" type="submit" disabled={busy}>
          {busy ? 'Please wait...' : mode === 'login' ? 'Login' : 'Create Account'}
        </button>

        <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-2)', marginTop: 14 }}>
          <Link to="/" style={{ color: 'var(--blue)' }}>← Continue as guest</Link>
        </p>
      </form>
    </div>
  )
}