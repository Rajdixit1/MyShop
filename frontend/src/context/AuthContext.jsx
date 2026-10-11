import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api, hasUserToken, setUserToken } from '../api'

const AuthContext = createContext(null)
const USER_KEY = 'rashan-user'

function loadUser() {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(loadUser)
  const [loading, setLoading] = useState(hasUserToken())

  const logout = useCallback(() => {
    setUserToken('')
    setUser(null)
    localStorage.removeItem(USER_KEY)
  }, [])

  // Re-validate a stored session on startup so expired tokens clear out.
  useEffect(() => {
    if (!hasUserToken()) return
    api
      .me()
      .then((fresh) => {
        setUser(fresh)
        localStorage.setItem(USER_KEY, JSON.stringify(fresh))
      })
      .catch(() => logout())
      .finally(() => setLoading(false))
  }, [logout])

  const login = useCallback(async (phone, password) => {
    const res = await api.login({ phone, password })
    setUserToken(res.token)
    setUser(res.user)
    localStorage.setItem(USER_KEY, JSON.stringify(res.user))
    return res.user
  }, [])

  const register = useCallback(async (payload) => {
    const res = await api.register(payload)
    setUserToken(res.token)
    setUser(res.user)
    localStorage.setItem(USER_KEY, JSON.stringify(res.user))
    return res.user
  }, [])

  const value = useMemo(
    () => ({ user, loading, login, register, logout }),
    [user, loading, login, register, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}