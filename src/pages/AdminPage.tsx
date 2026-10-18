// ─────────────────────────────────────────────────────────────
// MicBoard – AdminPage
// Main admin panel: sidebar nav + content area
// ─────────────────────────────────────────────────────────────

import { useState, useCallback, useEffect, useRef } from 'react'
import {
  Mic, Users, Monitor, Settings, LogOut, Plus, RefreshCw,
  Upload, X, LayoutDashboard, ChevronRight, AlertTriangle,
  LayoutGrid, List as ListIcon, ExternalLink, UserX, Search,
} from 'lucide-react'
import clsx from 'clsx'
import type { User, Display, RemoteData } from '../types'
import { useAuth } from '../hooks/useAuth'
import { useUsers, useDisplays, useRoles } from '../hooks/useFirebase'
import { useBildConfig } from '../hooks/useGitHub'
import { basePath } from '../lib/config'
import * as FB from '../lib/api'
import { fileToWebP, isValidImageFile } from '../lib/imageUtils'
import { useLogo, LOGO_PATH } from '../hooks/useLogo'
import DisplayPanel from '../components/admin/DisplayPanel'
import UserEditor from '../components/admin/UserEditor'
import ToastContainer, { useToasts } from '../components/common/Toast'
import LoadingSpinner from '../components/common/LoadingSpinner'
import { useAuthImage } from '../hooks/useAuthImage'
import type { BildConfig } from '../lib/bilder'

type Section = 'overview' | 'displays' | 'users' | 'settings'

// ── User card in the grid (needs its own component to call useAuthImage) ──

function UserCard({
  user, cfg, onClick,
}: { user: RemoteData<User>; cfg: BildConfig; onClick: () => void }) {
  const bgUrl = useAuthImage(user.data.image ? cfg : null, user.data.image ?? null)
  const u = user.data
  return (
    <button
      onClick={onClick}
      className="group relative flex flex-col overflow-hidden rounded-2xl bg-surface-700 border border-white/10 hover:border-brand-500/40 transition-all aspect-[3/4]"
    >
      {u.image && bgUrl && (
        <>
          <div className="absolute inset-0 overflow-hidden">
            <img
              src={bgUrl}
              alt=""
              className="w-full h-full object-cover select-none pointer-events-none"
              draggable={false}
              style={{
                objectPosition: `${u.imagePosition?.x ?? 50}% ${u.imagePosition?.y ?? 25}%`,
                transform: (u.imageScale ?? 1.0) !== 1 ? `scale(${u.imageScale})` : undefined,
                transformOrigin: `${u.imagePosition?.x ?? 50}% ${u.imagePosition?.y ?? 25}%`,
              }}
            />
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/0" />
        </>
      )}
      <div className="flex-1" />
      <div className="relative z-10 px-3 pb-3">
        <p className="text-base font-bold text-white leading-tight"
          style={u.color ? { color: u.color } : {}}>
          {u.displayName}
        </p>
        {u.role && <p className="text-xs text-white/40 mt-0.5 truncate">{u.role}</p>}
      </div>
      <div className="absolute inset-0 bg-brand-600/0 group-hover:bg-brand-600/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
        <span className="bg-black/60 text-white text-xs font-semibold px-3 py-1.5 rounded-full">Bearbeiten</span>
      </div>
    </button>
  )
}

// ── Overview card – one display with tile OR list view ─────────
// Handles its own slot-assignment saves (SHA ref pattern).

function OverviewAvatar({ user, cfg }: { user: User; cfg: BildConfig }) {
  const raw = user.image
    ? `${user.image}`
    : null
  const [src, setSrc] = useState<string | null>(raw)
  const handleError = async () => {
    if (!user.image) return
    const { getAuthImageUrl } = await import('../lib/imageCache')
    const url = await getAuthImageUrl(cfg, user.image)
    if (url) setSrc(url)
  }
  if (!src) return (
    <div className="w-full h-full flex items-center justify-center text-white/30 text-xs font-bold"
      style={user.color ? { color: user.color } : {}}>
      {user.displayName.charAt(0).toUpperCase()}
    </div>
  )
  return (
    <img src={src} alt={user.displayName} className="w-full h-full object-cover"
      style={{ objectPosition: `${user.imagePosition?.x ?? 50}% ${user.imagePosition?.y ?? 30}%` }}
      onError={handleError} />
  )
}

import SlotAssignment from '../components/admin/SlotAssignment'

function DisplayOverviewCard({
  displayData, users, cfg, onUpdated, viewMode, basePath,
}: {
  displayData: RemoteData<Display>
  users:       RemoteData<User>[]
  cfg:         BildConfig
  onUpdated:   () => Promise<void>
  viewMode:    'tile' | 'list'
  basePath:    string
}) {
  const display = displayData.data

  // Optimistic slots – updated instantly on assign; rolled back on error
  const [optimisticSlots, setOptimisticSlots] = useState<typeof display.slots | null>(null)
  const currentSlots  = optimisticSlots ?? display.slots
  const sorted        = currentSlots.slice().sort((a, b) => a.order - b.order)
  const assignedCount = currentSlots.filter((s) => s.userId).length

  const [clearingAll, setClearingAll] = useState(false)

  const saveAll = async (updated: Display) => {
    await FB.saveDisplay(updated)
    await onUpdated()
  }

  // Optimistic assign: UI updates instantly, API write in background
  const handleAssign = async (slotId: string, userId: string | undefined) => {
    // Auto-delete temporary users when unassigned or replaced
    const prevSlot   = display.slots.find((s) => s.id === slotId)
    const prevUserId = prevSlot?.userId
    const prevUser   = prevUserId ? users.find((u) => u.data.id === prevUserId)?.data : undefined
    const shouldDelete = prevUser?.temporary && prevUserId !== userId

    const newSlots = display.slots.map((s) => {
      if (s.id !== slotId) return s
      const { userId: _removed, ...rest } = s
      return userId !== undefined ? { ...rest, userId } : rest
    })
    setOptimisticSlots(newSlots)
    try {
      await saveAll({ ...display, slots: newSlots })
      if (shouldDelete && prevUserId) await FB.deleteUser(prevUserId)
    } catch (err) {
      setOptimisticSlots(null)
      alert(`Fehler: ${(err as Error).message}`)
    } finally {
      setOptimisticSlots(null)
    }
  }

  const handleQuickAdd = async (slotId: string, name: string, temporary = false) => {
    const id = 'user-' + Date.now().toString(36)
    await FB.saveUser({ id, displayName: name, fullName: name, active: true, temporary, createdAt: new Date().toISOString() })
    await handleAssign(slotId, id)
  }

  // Optimistic clear-all
  const handleClearAll = async () => {
    const assigned = currentSlots.filter((s) => s.userId)
    if (assigned.length === 0) { alert('Alle Slots sind bereits leer.'); return }
    if (!confirm(`Alle ${assigned.length} Zuweisung${assigned.length !== 1 ? 'en' : ''} aufheben?`)) return
    const tempUserIds = assigned
      .map((s) => s.userId)
      .filter((id) => id && users.find((u) => u.data.id === id)?.data.temporary) as string[]
    const cleared = display.slots.map(({ userId: _r, ...rest }) => rest)
    setOptimisticSlots(cleared)
    setClearingAll(true)
    try {
      await saveAll({ ...display, slots: cleared })
      await Promise.all(tempUserIds.map((id) => FB.deleteUser(id)))
    } catch (err) {
      setOptimisticSlots(null)
      alert(`Fehler: ${(err as Error).message}`)
    } finally {
      setClearingAll(false)
      setOptimisticSlots(null)
    }
  }

  const displayUrl = `${basePath}#/display/${display.id}`

  return (
    <div className="bg-surface-800 border border-white/10 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Monitor className="w-4 h-4 text-white/40" />
          <span className="font-semibold text-white">{display.name}</span>
          <span className="text-white/30 text-xs">{sorted.length} Slots</span>
        </div>
        <div className="flex items-center gap-2">
          {assignedCount > 0 && (
            <button
              onClick={handleClearAll}
              disabled={clearingAll}
              title="Alle Zuweisungen aufheben"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-white/40 hover:bg-amber-500/10 hover:text-amber-400 border border-transparent hover:border-amber-500/30 transition-colors disabled:opacity-40 text-xs font-medium"
            >
              {clearingAll
                ? <div className="w-3.5 h-3.5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                : <UserX className="w-3.5 h-3.5" />
              }
              Alle leeren
            </button>
          )}
          <a href={displayUrl} target="_blank" rel="noreferrer"
            className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1">
            öffnen <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Tile view */}
      {viewMode === 'tile' && (
        <div className="p-4 flex gap-3 overflow-x-auto">
          {sorted.length === 0 ? (
            <p className="text-white/25 text-sm py-2">Keine Slots – im Display anlegen</p>
          ) : sorted.map((slot) => (
            <div key={slot.id} className="flex flex-col gap-1.5 flex-1" style={{ minWidth: 120 }}>
              <p className="text-[10px] text-white/40 font-semibold uppercase tracking-wider truncate text-center">
                {slot.name}
              </p>
              <div className="h-48">
                <SlotAssignment
                  slot={slot}
                  users={users}
                  cfg={cfg}
                  onAssign={handleAssign}
                  onQuickAdd={handleQuickAdd}
                  saving={false}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* List view */}
      {viewMode === 'list' && (
        <div className="divide-y divide-white/5">
          {sorted.length === 0 && (
            <p className="px-5 py-4 text-white/25 text-sm">Keine Slots</p>
          )}
          {sorted.map((slot) => {
            const user = slot.userId ? users.find((u) => u.data.id === slot.userId)?.data : null
            return (
              <div key={slot.id} className="flex items-center gap-4 px-5 py-3">
                <div className="w-9 h-9 rounded-full overflow-hidden bg-surface-700 shrink-0 border border-white/10">
                  {user
                    ? <OverviewAvatar user={user} cfg={cfg} />
                    : <div className="w-full h-full flex items-center justify-center text-white/20 text-xs">—</div>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white/80 font-medium" style={user?.color ? { color: user.color } : {}}>
                    {user?.displayName ?? <span className="text-white/25">Niemand</span>}
                  </p>
                  {user?.fullName && user.fullName !== user.displayName && (
                    <p className="text-xs text-white/35 truncate">{user.fullName}</p>
                  )}
                </div>
                <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wider text-white/40 bg-surface-700 px-2.5 py-1 rounded-full border border-white/10">
                  {slot.name}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Roles editor (used in Settings) ──────────────────────────

function RolesEditor({
  roles, onSave, onReload,
}: {
  roles:    string[]
  onSave:   (roles: string[]) => Promise<void>
  onReload: () => Promise<void>
}) {
  const [draft, setDraft]   = useState('')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const add = async () => {
    const name = draft.trim()
    if (!name || roles.includes(name)) return
    setSaving(true)
    try { await onSave([...roles, name]); setDraft('') } catch (e) { alert((e as Error).message) } finally { setSaving(false) }
  }

  const remove = async (role: string) => {
    if (!confirm(`Rolle „${role}" wirklich löschen?\nNutzer mit dieser Rolle behalten ihren Wert, aber die Rolle steht nicht mehr zur Auswahl.`)) return
    setSaving(true)
    try { await onSave(roles.filter((r) => r !== role)) } catch (e) { alert((e as Error).message) } finally { setSaving(false) }
  }

  return (
    <div className="bg-surface-800 border border-white/10 rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-white/70 uppercase tracking-wider">Rollen</p>
        <button onClick={onReload} className="p-1.5 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors" title="Neu laden">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>
      <p className="text-xs text-white/35">
        Hier definierst du, welche Rollen bei Nutzern auswählbar sind (z. B. Prediger, Worship, Vox).
      </p>

      {/* Existing roles */}
      {roles.length === 0 ? (
        <p className="text-xs text-white/25 italic">Noch keine Rollen angelegt.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {roles.map((role) => (
            <div key={role} className="flex items-center gap-1.5 bg-surface-700 border border-white/10 rounded-xl px-3 py-1.5">
              <span className="text-sm text-white/80">{role}</span>
              <button
                onClick={() => remove(role)}
                disabled={saving}
                className="text-white/25 hover:text-red-400 transition-colors disabled:opacity-40"
                title="Löschen"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add new role */}
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') add() }}
          placeholder="Neue Rolle (z. B. Prediger)"
          disabled={saving}
          className="flex-1 bg-surface-700 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-brand-500 transition-colors disabled:opacity-50"
        />
        <button
          onClick={add}
          disabled={!draft.trim() || saving}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-sm transition-colors disabled:opacity-40"
        >
          {saving
            ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            : <Plus className="w-4 h-4" />
          }
          Hinzufügen
        </button>
      </div>
    </div>
  )
}

export default function AdminPage() {
  const { logout }                  = useAuth()
  const cfg                         = useBildConfig()
  const logoUrl                     = useLogo(cfg)
  const { users, loading: ul, error: ue, reload: reloadUsers, save: saveUser, remove: removeUser } = useUsers()
  const { displays, loading: dl, error: de, reload: reloadDisplays } = useDisplays()
  const { roles, save: saveRoles, reload: reloadRoles } = useRoles()

  const [section, setSection]           = useState<Section>('overview')
  const [overviewMode, setOverviewMode] = useState<'tile' | 'list'>('tile')
  const [activeDisplayId, setActiveDisplayId] = useState<string | null>(null)
  const [editingUser, setEditingUser]   = useState<RemoteData<User> | 'new' | null>(null)
  const [userSearch, setUserSearch]     = useState('')
  const [userSort, setUserSort]         = useState<'alpha' | 'role' | 'date'>('alpha')
  const { toasts, toast, dismiss }      = useToasts()

  const activeDisplay = displays.find((d) => d.data.id === activeDisplayId)

  // ── Select first display automatically ──────────────────
  // Must be in useEffect – calling setState during render causes infinite loops

  useEffect(() => {
    if (!activeDisplayId && displays.length > 0) {
      setActiveDisplayId(displays[0].data.id)
    }
  }, [activeDisplayId, displays])

  // ── Add display ──────────────────────────────────────────

  const addDisplay = useCallback(async () => {
    const name = prompt('Display-Name (z. B. Hauptbühne):')
    if (!name) return
    const id = 'display-' + Date.now().toString(36)
    const newDisplay: Display = { id, name: name.trim(), slots: [], layout: 'grid' }
    try {
      await FB.saveDisplay(newDisplay)
      setActiveDisplayId(id)
      toast.success(`Display „${name}" erstellt.`)
    } catch (err) {
      toast.error((err as Error).message)
    }
  }, [toast])

  // ── Display updated – no-op with Firebase (listener auto-updates) ──

  const handleDisplayUpdated = useCallback(async () => {}, [])

  // ── Display deleted ──────────────────────────────────────

  const handleDisplayDeleted = useCallback((deletedId: string) => {
    if (activeDisplayId === deletedId) {
      const remaining = displays.filter((d) => d.data.id !== deletedId)
      setActiveDisplayId(remaining.length > 0 ? remaining[0].data.id : null)
    }
    toast.success('Display gelöscht.')
  }, [activeDisplayId, displays, toast])

  // ── Reset all data ───────────────────────────────────────

  const [resetting, setResetting] = useState(false)

  const handleRepoReset = useCallback(async () => {
    const confirmed = confirm(
      '⚠️ ALLE Nutzer und Displays werden unwiderruflich gelöscht!\n\n' +
      'Wirklich fortfahren?',
    )
    if (!confirmed) return
    setResetting(true)
    try {
      // Delete all users and displays from Firebase
      await Promise.all([
        ...users.map((u) => FB.deleteUser(u.data.id)),
        ...displays.map((d) => FB.deleteDisplay(d.data.id)),
      ])
      setActiveDisplayId(null)
      toast.success('Alle Daten gelöscht.')
    } catch (err) {
      toast.error(`Fehler beim Reset: ${(err as Error).message}`)
    } finally {
      setResetting(false)
    }
  }, [users, displays, toast])

  // ── User saved ───────────────────────────────────────────

  const handleUserSaved = useCallback(async (user: User) => {
    await reloadUsers()
    setEditingUser(null)
    toast.success(`Nutzer „${user.displayName}" gespeichert.`)
  }, [reloadUsers, toast])

  // ── User deleted ─────────────────────────────────────────

  const handleUserDeleted = useCallback(async () => {
    await reloadUsers()
    setEditingUser(null)
    toast.success('Nutzer gelöscht.')
  }, [reloadUsers, toast])

  // ── Logo upload ───────────────────────────────────────────

  const logoInputRef             = useRef<HTMLInputElement>(null)
  const [logoUploading, setLogoUploading] = useState(false)
  const [logoPreview, setLogoPreview]     = useState<string | null>(null)

  const handleLogoUpload = useCallback(async (file: File) => {
    if (!cfg) return
    if (!isValidImageFile(file)) { toast.error('Nur Bilddateien erlaubt.'); return }
    setLogoUploading(true)
    try {
      const { base64, mime } = await fileToWebP(file, 512, 0.9, 'png')
      await FB.uploadImage(LOGO_PATH, base64)
      const preview = `data:${mime};base64,${base64}`
      setLogoPreview(preview)
      // Also update the favicon immediately
      const link = document.querySelector<HTMLLinkElement>("link[rel~='icon']")
      if (link) link.href = preview
      toast.success('Logo gespeichert.')
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setLogoUploading(false)
    }
  }, [cfg, toast])

  // ── Filtered + sorted user list ──────────────────────────

  const filteredUsers = users
    .filter((u) => {
      if (!userSearch) return true
      const q = userSearch.toLowerCase()
      return (
        u.data.displayName.toLowerCase().includes(q) ||
        u.data.fullName.toLowerCase().includes(q) ||
        (u.data.role?.toLowerCase().includes(q) ?? false)
      )
    })
    .slice()
    .sort((a, b) => {
      if (userSort === 'alpha') return a.data.displayName.localeCompare(b.data.displayName, 'de')
      if (userSort === 'role')  return (a.data.role ?? '').localeCompare(b.data.role ?? '', 'de')
      // date: newest first (updatedAt or createdAt)
      const da = a.data.updatedAt ?? a.data.createdAt ?? ''
      const db = b.data.updatedAt ?? b.data.createdAt ?? ''
      return db.localeCompare(da)
    })

  // ── Render ───────────────────────────────────────────────

  if (!cfg) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface-900 text-white">
        <p>Nicht konfiguriert. <a href="/" className="text-brand-400 underline">Setup öffnen</a></p>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-surface-900 overflow-hidden">
      {/* ── Sidebar ────────────────────────────────────────── */}
      <aside className="w-64 shrink-0 flex flex-col bg-surface-800 border-r border-white/10">
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
          <div className="w-8 h-8 rounded-lg bg-brand-600/30 border border-brand-500/40 flex items-center justify-center overflow-hidden shrink-0">
            {(logoPreview ?? logoUrl) ? (
              <img src={logoPreview ?? logoUrl!} alt="Logo" className="w-full h-full object-contain" />
            ) : (
              <Mic className="w-4 h-4 text-brand-400" />
            )}
          </div>
          <span className="font-bold text-white text-lg">MicBoard</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {/* Displays section */}
          <div className="mb-4">
            <div className="flex items-center justify-between px-3 mb-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/30">Displays</p>
              <button onClick={addDisplay}
                className="w-5 h-5 rounded flex items-center justify-center text-white/30 hover:text-white hover:bg-white/10 transition-colors">
                <Plus className="w-3 h-3" />
              </button>
            </div>

            {dl && <p className="px-3 py-2 text-xs text-white/30">Lädt …</p>}
            {de && <p className="px-3 py-2 text-xs text-red-400">{de}</p>}

            {displays.map((d) => (
              <button
                key={d.data.id}
                onClick={() => { setSection('displays'); setActiveDisplayId(d.data.id) }}
                className={clsx(
                  'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-colors group',
                  section === 'displays' && activeDisplayId === d.data.id
                    ? 'bg-brand-600/20 text-brand-300 border border-brand-500/30'
                    : 'text-white/60 hover:bg-white/5 hover:text-white',
                )}
              >
                <Monitor className="w-4 h-4 shrink-0" />
                <span className="text-sm font-medium truncate">{d.data.name}</span>
                <ChevronRight className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))}
          </div>

          {/* Other sections */}
          {([
            { id: 'overview'  as Section, icon: LayoutDashboard, label: 'Übersicht' },
            { id: 'users'     as Section, icon: Users,           label: 'Nutzer' },
            { id: 'settings'  as Section, icon: Settings,        label: 'Einstellungen' },
          ] as const).map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setSection(id)}
              className={clsx(
                'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-colors',
                section === id
                  ? 'bg-brand-600/20 text-brand-300 border border-brand-500/30'
                  : 'text-white/60 hover:bg-white/5 hover:text-white',
              )}
            >
              <Icon className="w-4 h-4" />
              <span className="text-sm font-medium">{label}</span>
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-white/10">
          <button
            onClick={logout}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-white/40 hover:text-red-400 hover:bg-red-500/5 transition-colors text-sm"
          >
            <LogOut className="w-4 h-4" />
            Ausloggen
          </button>
        </div>
      </aside>

      {/* ── Main content ───────────────────────────────────── */}
      <main className="flex-1 flex overflow-hidden">
        {/* Displays section */}
        {section === 'displays' && activeDisplay && (
          <DisplayPanel
            key={activeDisplay.data.id}
            displayData={activeDisplay}
            users={users}
            cfg={cfg}
            onUpdated={handleDisplayUpdated}
            onDeleted={handleDisplayDeleted}
            basePath={basePath()}
          />
        )}

        {section === 'displays' && !activeDisplay && (
          <div className="flex-1 flex flex-col items-center justify-center gap-6">
            {dl ? (
              <LoadingSpinner label="Displays werden geladen …" />
            ) : (
              <>
                <Monitor className="w-16 h-16 text-white/10" />
                <div className="text-center">
                  <p className="text-white/50 font-medium">Noch kein Display vorhanden</p>
                  <p className="text-white/25 text-sm mt-1">Erstelle dein erstes Display über das + oben links</p>
                </div>
                <button onClick={addDisplay}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold transition-colors">
                  <Plus className="w-4 h-4" />
                  Display erstellen
                </button>
              </>
            )}
          </div>
        )}

        {/* ── Overview section ───────────────────────────── */}
        {section === 'overview' && (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-white">Gesamtübersicht</h2>
              <div className="flex items-center gap-2">
                {/* Tile / List toggle */}
                <div className="flex items-center bg-surface-700 rounded-lg p-1 gap-1">
                  <button
                    onClick={() => setOverviewMode('tile')}
                    className={clsx('p-1.5 rounded-md transition-colors', overviewMode === 'tile' ? 'bg-brand-600 text-white' : 'text-white/40 hover:text-white')}
                    title="Kachelansicht"
                  ><LayoutGrid className="w-4 h-4" /></button>
                  <button
                    onClick={() => setOverviewMode('list')}
                    className={clsx('p-1.5 rounded-md transition-colors', overviewMode === 'list' ? 'bg-brand-600 text-white' : 'text-white/40 hover:text-white')}
                    title="Listenansicht"
                  ><ListIcon className="w-4 h-4" /></button>
                </div>
                <button onClick={() => { reloadDisplays(); reloadUsers() }} disabled={dl || ul}
                  className="p-2 rounded-lg bg-surface-700 text-white/50 hover:bg-surface-600 transition-colors">
                  <RefreshCw className={clsx('w-4 h-4', (dl || ul) && 'animate-spin')} />
                </button>
              </div>
            </div>
            {(dl || ul) && <LoadingSpinner label="Lädt …" className="mt-12" />}
            <div className="space-y-6">
              {displays.map((d) => (
                <DisplayOverviewCard
                  key={d.data.id}
                  displayData={d}
                  users={users}
                  cfg={cfg}
                  onUpdated={handleDisplayUpdated}
                  viewMode={overviewMode}
                  basePath={basePath()}
                />
              ))}
            </div>
          </div>
        )}

        {/* Users section */}
        {section === 'users' && !editingUser && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white">Nutzer</h2>
                <div className="flex items-center gap-2">
                  <button onClick={reloadUsers} disabled={ul}
                    className="p-2 rounded-lg bg-surface-700 text-white/50 hover:bg-surface-600 transition-colors">
                    <RefreshCw className={clsx('w-4 h-4', ul && 'animate-spin')} />
                  </button>
                  <button onClick={() => setEditingUser('new')}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-sm transition-colors">
                    <Plus className="w-4 h-4" />
                    Neuer Nutzer
                  </button>
                </div>
              </div>
              {/* Search + sort */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
                  <input
                    type="text"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Suchen …"
                    className="w-full bg-surface-700 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-white text-sm placeholder-white/25 focus:outline-none focus:border-brand-500 transition-colors"
                  />
                  {userSearch && (
                    <button onClick={() => setUserSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <select
                  value={userSort}
                  onChange={(e) => setUserSort(e.target.value as typeof userSort)}
                  className="bg-surface-700 border border-white/10 rounded-xl px-3 py-2 text-white/70 text-sm focus:outline-none focus:border-brand-500 transition-colors"
                >
                  <option value="alpha">A – Z</option>
                  <option value="role">Nach Rolle</option>
                  <option value="date">Neueste zuerst</option>
                </select>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {ul && <LoadingSpinner label="Nutzer laden …" className="mt-12" />}
              {ue && <p className="text-red-400 text-sm">{ue}</p>}

              {!ul && users.length === 0 && (
                <div className="flex flex-col items-center justify-center h-48 gap-4">
                  <Users className="w-12 h-12 text-white/10" />
                  <p className="text-white/40">Noch keine Nutzer vorhanden.</p>
                  <button onClick={() => setEditingUser('new')}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-sm transition-colors">
                    <Plus className="w-4 h-4" />
                    Ersten Nutzer anlegen
                  </button>
                </div>
              )}

              {!ul && users.length > 0 && filteredUsers.length === 0 && (
                <p className="text-white/30 text-sm text-center mt-12">Keine Nutzer für „{userSearch}" gefunden.</p>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {filteredUsers.map((u) => (
                  <UserCard
                    key={u.data.id}
                    user={u}
                    cfg={cfg}
                    onClick={() => setEditingUser(u)}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {section === 'users' && editingUser && (
          <div className="flex-1 overflow-hidden">
            <UserEditor
              existing={editingUser === 'new' ? undefined : editingUser}
              cfg={cfg}
              displays={displays}
              roles={roles}
              onSaved={handleUserSaved}
              onDeleted={editingUser !== 'new' ? handleUserDeleted : undefined}
              onCancel={() => setEditingUser(null)}
            />
          </div>
        )}

        {/* Settings section */}
        {section === 'settings' && (
          <div className="flex-1 overflow-y-auto p-8">
            <h2 className="text-xl font-bold text-white mb-6">Einstellungen</h2>

            <div className="max-w-lg space-y-5">

              {/* ── Rollen ── */}
              <RolesEditor roles={roles} onSave={saveRoles} onReload={reloadRoles} />

              {/* Logo upload */}
              <div className="bg-surface-800 border border-white/10 rounded-2xl p-5 space-y-4">
                <p className="text-sm font-semibold text-white/70 uppercase tracking-wider">Logo</p>
                <p className="text-xs text-white/40">
                  Wird als Favicon und Sidebar-Icon verwendet. Empfohlen: quadratisches Bild, min. 256×256 px.
                </p>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-xl bg-surface-700 border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
                    {(logoPreview ?? logoUrl) ? (
                      <img src={logoPreview ?? logoUrl!} alt="Logo" className="w-full h-full object-contain p-1" />
                    ) : (
                      <Mic className="w-7 h-7 text-white/20" />
                    )}
                  </div>
                  <div className="flex-1">
                    <button
                      onClick={() => logoInputRef.current?.click()}
                      disabled={logoUploading}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface-700 hover:bg-surface-600 text-white/70 hover:text-white border border-white/10 text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      <Upload className="w-4 h-4" />
                      {logoUploading ? 'Wird hochgeladen …' : 'Logo hochladen'}
                    </button>
                    <p className="text-xs text-white/30 mt-1.5">PNG, JPEG oder WebP</p>
                  </div>
                </div>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f) }}
                />
              </div>
              <div className="bg-surface-800 border border-red-500/20 rounded-2xl p-5 space-y-3">
                <p className="text-sm font-semibold text-red-400/80 uppercase tracking-wider">Gefahrenbereich</p>

                {/* Repo hard-reset */}
                <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/5 border border-red-500/20">
                  <AlertTriangle className="w-5 h-5 text-red-400/70 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-white/70 font-medium mb-1">Repo zurücksetzen (Hard Reset)</p>
                    <p className="text-xs text-white/35 mb-3">
                      Löscht ALLE Nutzer, Displays und Bilder im privaten Daten-Repo und erstellt
                      Standard-Daten neu. Nicht rückgängig zu machen.
                    </p>
                    <button
                      onClick={handleRepoReset}
                      disabled={resetting}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/15 border border-red-500/40 text-red-400 hover:bg-red-500/25 text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      {resetting
                        ? <><div className="w-3.5 h-3.5 border-2 border-red-400 border-t-transparent rounded-full animate-spin" /> Wird zurückgesetzt …</>
                        : <><AlertTriangle className="w-3.5 h-3.5" /> Alles löschen & neu starten</>
                      }
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}
