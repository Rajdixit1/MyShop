import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAdmin } from '../../context/AdminContext'

export default function AdminLogin() {
  const { login } = useAdmin()
  const navigate = useNavigate()
  const [form, setForm] = useState({ username: 'admin', password: 'admin123' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await login(form.username, form.password)
      navigate('/admin', { replace: true })
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-box" onSubmit={submit}>
        <div style={{ fontSize: 34, marginBottom: 6 }}>🛒</div>
        <h2>Admin Panel</h2>
        <p className="sub">Devenand Saw Kirana Store management</p>

        <div className="field">
          <label htmlFor="adm-user">Username</label>
          <input
            id="adm-user"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            placeholder="admin"
          />
        </div>
        <div className="field">
          <label htmlFor="adm-pass">Password</label>
          <input
            id="adm-pass"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="Password"
          />
        </div>

        {error && <div className="issue-warn">{error}</div>}

        <button className="btn-primary" type="submit" disabled={busy}>
          {busy ? 'Signing in...' : 'Login to Dashboard'}
        </button>
        <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-2)', marginTop: 14 }}>
          Demo login: <strong>admin</strong> / <strong>admin123</strong>
        </p>
      </form>
    </div>
  )
}