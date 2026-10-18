// ─────────────────────────────────────────────────────────────
// MicBoard – React-Hooks für den eigenen Server (Dateiname historisch)
// Returns RemoteData<T>-compatible objects (sha='') so existing
// components work without change.  sha is a GitHub concept that
// Firebase doesn't need – it's simply ignored in all FB writes.
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react'
import type { User, Display, AppSettings, RemoteData } from '../types'
import * as FB from '../lib/api'

// ── Users ─────────────────────────────────────────────────────

export function useUsers() {
  const [users,   setUsers]   = useState<RemoteData<User>[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    try {
      const unsub = FB.onUsersChange((all) => {
        setUsers(all.map((u) => ({ data: u, sha: '', path: `users/${u.id}` })))
        setLoading(false)
        setError(null)
      })
      return unsub
    } catch (e) {
      setError((e as Error).message)
      setLoading(false)
    }
  }, [])

  const save = useCallback(async (user: User, _sha?: string): Promise<string> => {
    await FB.saveUser(user)
    return ''
  }, [])

  const remove = useCallback(async (id: string, _sha: string): Promise<void> => {
    await FB.deleteUser(id)
  }, [])

  // reload is a no-op: Firebase listener keeps state current automatically
  const reload = useCallback(async () => {}, [])

  return { users, loading, error, reload, save, remove }
}

// ── Displays ──────────────────────────────────────────────────

export function useDisplays() {
  const [displays, setDisplays] = useState<RemoteData<Display>[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    try {
      const unsub = FB.onDisplaysChange((all) => {
        setDisplays(all.map((d) => ({ data: d, sha: '', path: `displays/${d.id}` })))
        setLoading(false)
        setError(null)
      })
      return unsub
    } catch (e) {
      setError((e as Error).message)
      setLoading(false)
    }
  }, [])

  const save = useCallback(async (display: Display, _sha?: string): Promise<string> => {
    await FB.saveDisplay(display)
    return ''
  }, [])

  const remove = useCallback(async (id: string, _sha: string): Promise<void> => {
    await FB.deleteDisplay(id)
  }, [])

  const reload = useCallback(async () => {}, [])

  return { displays, loading, error, reload, save, remove }
}

// ── Roles ──────────────────────────────────────────────────────

export function useRoles() {
  const [roles,   setRoles]   = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    try {
      const unsub = FB.onRolesChange((r) => {
        setRoles(r)
        setLoading(false)
        setError(null)
      })
      return unsub
    } catch (e) {
      setError((e as Error).message)
      setLoading(false)
    }
  }, [])

  const save = useCallback(async (roles: string[]): Promise<void> => {
    await FB.saveRoles(roles)
  }, [])

  const reload = useCallback(async () => {}, [])

  return { roles, loading, error, reload, save }
}

// ── Settings ──────────────────────────────────────────────────

export function useSettings() {
  const [settings, setSettings] = useState<RemoteData<AppSettings> | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)

  useEffect(() => {
    FB.getSettings()
      .then((s) => {
        setSettings({ data: s, sha: '', path: 'config/settings' })
        setLoading(false)
      })
      .catch((e) => {
        setError((e as Error).message)
        setLoading(false)
      })
  }, [])

  const save = useCallback(async (s: AppSettings): Promise<void> => {
    await FB.saveSettings(s)
    setSettings({ data: s, sha: '', path: 'config/settings' })
  }, [])

  return { settings, loading, error, save }
}
