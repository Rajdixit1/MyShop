import { useEffect, useState } from 'react'
import { api } from '../../api'

export default function AdminCustomers() {
  const [customers, setCustomers] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    api.adminCustomers().then(setCustomers).catch((e) => setError(e.message))
  }, [])

  if (error) return <div className="error-box">{error}</div>

  return (
    <>
      <div className="admin-head">
        <h1>Customers ({customers.length})</h1>
      </div>

      <div className="admin-card">
        <table className="data">
          <thead>
            <tr><th>#</th><th>Name</th><th>Mobile</th><th>Default address</th><th>Joined</th></tr>
          </thead>
          <tbody>
            {customers.map((u, i) => (
              <tr key={u.id}>
                <td>{i + 1}</td>
                <td style={{ fontWeight: 500 }}>{u.name}</td>
                <td>+91 {u.phone}</td>
                <td style={{ maxWidth: 320, fontSize: 12, color: 'var(--text-2)' }}>
                  {u.address || '-'}
                </td>
                <td style={{ fontSize: 12, color: 'var(--text-2)' }}>
                  {u.created_at.replace('T', ' ')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {customers.length === 0 && (
          <p style={{ padding: 20, textAlign: 'center', color: 'var(--text-2)' }}>
            No customers registered yet.
          </p>
        )}
      </div>
    </>
  )
}