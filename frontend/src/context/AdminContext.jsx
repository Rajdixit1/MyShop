import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { api, hasAdminToken, setAdminToken } from '../api'

const AdminContext = createContext(null)

export function AdminProvider({ children }) {
  const [admin, setAdmin] = useState(null)
  const [checking, setChecking] = useState(hasAdminToken())

  useEffect(() => {
    if (!hasAdminToken()) {
      setChecking(false)
      return
    }
    api
      .adminStats()
      .then(() => setAdmin({ username: 'admin' }))
      .catch(() => {
        setAdminToken('')
        setAdmin(null)
      })
      .finally(() => setChecking(false))
  }, [])

  const login = useMemo(
    () => async (username, password) => {
      const res = await api.adminLogin({ username, password })
      setAdminToken(res.token)
      setAdmin({ username: res.username || username })
      return res
    },
    [],
  )

  const logout = useMemo(() => () => {
    setAdminToken('')
    setAdmin(null)
  }, [])

  const value = useMemo(() => ({ admin, checking, login, logout }), [admin, checking, login, logout])
  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>
}

export function useAdmin() {
  const ctx = useContext(AdminContext)
  if (!ctx) throw new Error('useAdmin must be used inside AdminProvider')
  return ctx
}