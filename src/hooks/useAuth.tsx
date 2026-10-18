// ─────────────────────────────────────────────────────────────
// MicBoard – Anmeldung am eigenen Server.
// Der Server gibt nach dem Passwort einen Schlüssel (30 Tage gültig),
// der im Browser bleibt. Volunteers müssen sich so nicht jedes Mal anmelden.
// ─────────────────────────────────────────────────────────────

import {
  createContext, useContext, useState, useCallback,
  useEffect, type ReactNode,
} from 'react'
import * as API from '../lib/api'

interface AuthCtx {
  isAuthenticated: boolean
  error: string | null
  login: (password: string) => Promise<boolean>
  setup: (password: string) => Promise<boolean>
  logout: () => void
  clearError: () => void
}

const AuthContext = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => !!API.getToken())
  const [error, setError] = useState<string | null>(null)

  // Lehnt der Server den Schlüssel ab (abgelaufen, Passwort geändert), zurück zur Anmeldung
  useEffect(() => {
    const weg = () => setIsAuthenticated(false)
    window.addEventListener('micboard-abgemeldet', weg)
    return () => window.removeEventListener('micboard-abgemeldet', weg)
  }, [])

  const login = useCallback(async (password: string): Promise<boolean> => {
    setError(null)
    try {
      await API.login(password)
      setIsAuthenticated(true)
      return true
    } catch (e) {
      setError((e as Error).message === 'Falsches Passwort' ? 'Falsches Passwort. Bitte erneut versuchen.' : (e as Error).message)
      return false
    }
  }, [])

  const setup = useCallback(async (password: string): Promise<boolean> => {
    setError(null)
    try {
      await API.setupPassword(password)
      setIsAuthenticated(true)
      return true
    } catch (e) {
      setError((e as Error).message)
      return false
    }
  }, [])

  const logout = useCallback(() => {
    setIsAuthenticated(false)
    API.logout().catch(() => {})
  }, [])

  return (
    <AuthContext.Provider value={{ isAuthenticated, error, login, setup, logout, clearError: () => setError(null) }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthCtx {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
