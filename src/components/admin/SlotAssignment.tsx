// ─────────────────────────────────────────────────────────────
// MicBoard – SlotAssignment
// Quick assignment widget: clicking a slot opens a centred modal
// so positioning is always perfect regardless of layout or screen count.
// ─────────────────────────────────────────────────────────────

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Search, X, UserX, UserMinus, UserPlus, Clock } from 'lucide-react'
import clsx from 'clsx'
import type { User, Slot, RemoteData } from '../../types'
import type { BildConfig } from '../../lib/bilder'
import { positionToCss } from '../../lib/imageUtils'
import { useAuthImage } from '../../hooks/useAuthImage'
import { getAuthImageUrl } from '../../lib/imageCache'

interface Props {
  slot:         Slot
  users:        RemoteData<User>[]
  cfg:          BildConfig
  onAssign:     (slotId: string, userId: string | undefined) => Promise<void>
  onQuickAdd?:  (slotId: string, name: string, temporary?: boolean) => Promise<void>
  saving?:      boolean
}

// ── Per-row avatar ────────────────────────────────────────────

function UserAvatar({ user, cfg }: { user: User; cfg: BildConfig }) {
  const raw = user.image
    ? `${user.image}`
    : null
  const [src, setSrc] = useState<string | null>(raw)

  const handleError = async () => {
    if (!user.image) return
    const url = await getAuthImageUrl(cfg, user.image)
    if (url) setSrc(url)
  }

  if (!src) return (
    <div className="w-full h-full flex items-center justify-center text-white/40 text-sm font-bold"
      style={user.color ? { color: user.color } : {}}>
      {user.displayName.charAt(0).toUpperCase()}
    </div>
  )
  return (
    <img src={src} alt={user.displayName} className="w-full h-full object-cover"
      style={{ objectPosition: positionToCss(user.imagePosition?.x, user.imagePosition?.y) }}
      onError={handleError} />
  )
}

// ── Main component ────────────────────────────────────────────

export default function SlotAssignment({ slot, users, cfg, onAssign, onQuickAdd, saving }: Props) {
  const [open, setOpen]         = useState(false)
  const [query, setQuery]       = useState('')
  const [adding, setAdding]     = useState<'normal' | 'temp' | null>(null)
  const inputRef                = useRef<HTMLInputElement>(null)

  const assigned  = users.find((u) => u.data.id === slot.userId)?.data
  const slotBgUrl = useAuthImage(assigned?.image ? cfg : null, assigned?.image ?? null)

  const filtered = users
    .map((u) => u.data)
    .filter((u) =>
      u.active !== false &&
      (
        u.displayName.toLowerCase().includes(query.toLowerCase()) ||
        u.fullName.toLowerCase().includes(query.toLowerCase()) ||
        (u.role?.toLowerCase().includes(query.toLowerCase()) ?? false)
      ),
    )

  // Focus search when modal opens
  useEffect(() => {
    if (open) {
      setQuery('')
      setTimeout(() => inputRef.current?.focus(), 60)
    }
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open])

  const select = async (userId: string | undefined) => {
    setOpen(false)
    await onAssign(slot.id, userId)
  }

  const quickAdd = async (temporary = false) => {
    if (!onQuickAdd || !query.trim()) return
    setAdding(temporary ? 'temp' : 'normal')
    try {
      await onQuickAdd(slot.id, query.trim(), temporary)
      setOpen(false)
    } finally {
      setAdding(null)
    }
  }

  // ── Centred modal (portal) ────────────────────────────────

  const modal = open ? createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />

      {/* Panel */}
      <div
        className="fixed z-[9999] inset-0 flex items-center justify-center p-4 pointer-events-none"
      >
        <div
          className="pointer-events-auto w-full max-w-sm bg-surface-800 border border-white/15 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
          style={{ maxHeight: '80vh' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal header: slot name */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
            <div>
              <p className="text-[10px] text-white/35 uppercase tracking-widest mb-0.5">Slot belegen</p>
              <p className="font-bold text-white text-base">{slot.name}</p>
            </div>
            <button onClick={() => setOpen(false)} className="p-1.5 text-white/30 hover:text-white/70 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Search */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 shrink-0">
            <Search className="w-4 h-4 text-white/40 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Person suchen …"
              onKeyDown={(e) => { if (e.key === 'Enter' && query.trim() && onQuickAdd) quickAdd(false) }}
              className="flex-1 bg-transparent text-white placeholder-white/30 text-sm outline-none"
            />
            {query && (
              <button onClick={() => setQuery('')} className="text-white/40 hover:text-white/70">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Scrollable list */}
          <div className="overflow-y-auto">
            {/* Unassign */}
            <button
              onClick={() => select(undefined)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors border-b border-white/5 text-left"
            >
              <div className="w-10 h-10 rounded-full bg-surface-700 flex items-center justify-center shrink-0">
                <UserX className="w-4 h-4 text-white/40" />
              </div>
              <div>
                <p className="text-sm text-white/50 font-medium">Niemanden zuweisen</p>
                <p className="text-xs text-white/25">Slot leeren</p>
              </div>
            </button>

            {/* Quick-add: shown whenever there is a search query */}
            {query.trim() && onQuickAdd && (
              <div className="border-b border-white/5">
                {/* Permanent quick-add */}
                <button
                  onClick={() => quickAdd(false)}
                  disabled={adding !== null}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-brand-600/15 text-left transition-colors disabled:opacity-50"
                >
                  <div className="w-10 h-10 rounded-full bg-brand-600/20 border border-brand-500/30 flex items-center justify-center shrink-0">
                    {adding === 'normal'
                      ? <div className="w-4 h-4 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
                      : <UserPlus className="w-4 h-4 text-brand-400" />}
                  </div>
                  <div>
                    <p className="text-sm text-brand-300 font-semibold">„{query.trim()}" anlegen & zuweisen</p>
                    <p className="text-xs text-white/30">Bleibt im Nutzer-Tab · kann mit Foto vervollständigt werden</p>
                  </div>
                </button>
                {/* Temporary quick-add */}
                <button
                  onClick={() => quickAdd(true)}
                  disabled={adding !== null}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-amber-500/10 text-left transition-colors disabled:opacity-50"
                >
                  <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0">
                    {adding === 'temp'
                      ? <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                      : <Clock className="w-4 h-4 text-amber-400" />}
                  </div>
                  <div>
                    <p className="text-sm text-amber-300 font-semibold">„{query.trim()}" temporär zuweisen</p>
                    <p className="text-xs text-white/30">Wird automatisch gelöscht wenn der Slot geleert wird</p>
                  </div>
                </button>
              </div>
            )}

            {/* Users */}
            {filtered.length === 0 ? (
              <p className="px-4 py-6 text-center text-white/30 text-sm">Keine Personen gefunden</p>
            ) : (
              filtered.map((user) => (
                <button
                  key={user.id}
                  onClick={() => select(user.id)}
                  className={clsx(
                    'w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left',
                    slot.userId === user.id && 'bg-brand-600/15',
                  )}
                >
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-surface-700 shrink-0">
                    <UserAvatar user={user} cfg={cfg} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-semibold truncate"
                      style={user.color ? { color: user.color } : {}}>
                      {user.displayName}
                    </p>
                    {user.fullName !== user.displayName && (
                      <p className="text-xs text-white/40 truncate">{user.fullName}</p>
                    )}
                    {user.role && (
                      <p className="text-xs text-white/30 truncate">{user.role}</p>
                    )}
                  </div>
                  {slot.userId === user.id && (
                    <div className="w-2 h-2 rounded-full bg-brand-400 shrink-0" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </>,
    document.body,
  ) : null

  // ── Slot tile ─────────────────────────────────────────────

  return (
    <div className="relative h-full group/tile">

      {/* Tile */}
      <button
        onClick={() => !saving && setOpen(true)}
        disabled={saving}
        className={clsx(
          'relative flex flex-col overflow-hidden rounded-2xl border transition-all w-full h-full group',
          open
            ? 'border-brand-500/60 ring-1 ring-brand-500/30'
            : 'border-white/10 hover:border-white/25',
          saving ? 'opacity-60 cursor-wait' : 'cursor-pointer',
        )}
      >
        {/* Background */}
        {assigned?.image && slotBgUrl ? (
          <>
            <div className="absolute inset-0 overflow-hidden">
              <img
                src={slotBgUrl} alt=""
                className="w-full h-full object-cover select-none pointer-events-none"
                draggable={false}
                style={{
                  objectPosition:  positionToCss(assigned.imagePosition?.x, assigned.imagePosition?.y),
                  transform:       (assigned.imageScale ?? 1) !== 1 ? `scale(${assigned.imageScale})` : undefined,
                  transformOrigin: `${assigned.imagePosition?.x ?? 50}% ${assigned.imagePosition?.y ?? 30}%`,
                }}
              />
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10" />
          </>
        ) : (
          <div className="absolute inset-0 bg-surface-700" />
        )}

        {/* Slot badge */}
        <div className="relative z-10 px-3 pt-3">
          <span
            className="text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full bg-black/30 border border-white/20 text-white/80"
            style={slot.color ? { borderColor: slot.color + '60', color: slot.color } : {}}
          >
            {slot.name}
          </span>
        </div>

        <div className="flex-1" />

        {/* Name */}
        <div className="relative z-10 px-3 pb-3">
          {assigned ? (
            <p className="text-lg font-bold text-white leading-tight drop-shadow-lg"
              style={assigned.color ? { color: assigned.color } : {}}>
              {assigned.displayName}
            </p>
          ) : (
            <p className="text-sm text-white/30">Niemand</p>
          )}
        </div>

        {/* Hover hint */}
        <div className="absolute inset-0 bg-brand-600/0 group-hover:bg-brand-600/10 transition-colors rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100">
          <span className="bg-black/60 text-white text-xs font-semibold px-3 py-1.5 rounded-full">
            {assigned ? 'Ändern' : 'Zuweisen'}
          </span>
        </div>

        {/* Saving */}
        {saving && (
          <div className="absolute inset-0 bg-surface-900/70 flex items-center justify-center rounded-2xl">
            <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </button>

      {/* Quick unassign button (sibling, not nested) */}
      {assigned && !saving && (
        <button
          onClick={() => select(undefined)}
          title="Zuweisung aufheben"
          className="absolute top-2 right-2 z-10 w-6 h-6 rounded-full flex items-center justify-center bg-black/50 border border-white/20 opacity-0 group-hover/tile:opacity-100 hover:bg-red-500/30 hover:border-red-400/40 transition-all"
        >
          <UserMinus className="w-3 h-3 text-white/70" />
        </button>
      )}

      {modal}
    </div>
  )
}
