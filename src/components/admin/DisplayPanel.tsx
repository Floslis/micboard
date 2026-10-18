import { useState, useCallback, useRef, useEffect } from 'react'
import { Plus, ExternalLink, RefreshCw, Pencil, Trash2, Check, X, Monitor, UserX } from 'lucide-react'
import clsx from 'clsx'
import type { Display, Slot, User, RemoteData, DisplayAspectRatio } from '../../types'
import type { BildConfig } from '../../lib/bilder'
import * as FB from '../../lib/api'
import SlotAssignment from './SlotAssignment'

const ASPECT_RATIO_OPTIONS: DisplayAspectRatio[] = ['16:9', '21:9', '32:9']

interface Props {
  displayData: RemoteData<Display>
  users:       RemoteData<User>[]
  cfg:         BildConfig          // still needed for image reads
  onUpdated:   () => Promise<void>
  onDeleted?:  (id: string) => void
  basePath?:   string
}

function generateSlotId(): string {
  return 'slot-' + Date.now().toString(36)
}

// ── Inline text editor (only used for the display name in the header) ──

function InlineEditor({
  value, onSave, onCancel, placeholder,
}: { value: string; onSave: (v: string) => void; onCancel: () => void; placeholder?: string }) {
  const [text, setText] = useState(value)
  return (
    <div className="flex items-center gap-1 flex-1" onClick={(e) => e.stopPropagation()}>
      <input
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        onKeyDown={(e) => {
          if (e.key === 'Enter')  onSave(text.trim() || value)
          if (e.key === 'Escape') onCancel()
        }}
        className="flex-1 text-sm bg-surface-600 border border-brand-500/60 rounded-lg px-3 py-1.5 text-white outline-none"
      />
      <button onClick={() => onSave(text.trim() || value)}
        className="p-1.5 text-green-400 hover:text-green-300"><Check className="w-3.5 h-3.5" /></button>
      <button onClick={onCancel}
        className="p-1.5 text-white/40 hover:text-white/70"><X className="w-3.5 h-3.5" /></button>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────

export default function DisplayPanel({
  displayData, users, cfg, onUpdated, onDeleted, basePath = '/',
}: Props) {
  const display     = displayData.data

  const [savingSlot, setSavingSlot]                 = useState<string | null>(null)
  const [editingDisplayName, setEditingDisplayName] = useState(false)
  const [refreshing, setRefreshing]                 = useState(false)
  const [deleting, setDeleting]                     = useState(false)
  const [clearingAll, setClearingAll]               = useState(false)

  // Optimistic slots: shown immediately, cleared after API confirms or rolls back
  const [optimisticSlots, setOptimisticSlots]       = useState<typeof display.slots | null>(null)

  // Always render from optimistic state if available, fall back to server data
  const currentSlots = optimisticSlots ?? display.slots
  const sortedSlots  = currentSlots.slice().sort((a, b) => a.order - b.order)

  // ── Core save helper (Firebase – no SHA needed) ────────────

  const saveDisplay = useCallback(async (updated: Display) => {
    await FB.saveDisplay(updated)
    await onUpdated()
  }, [onUpdated])

  // ── Slot assignment (optimistic) ───────────────────────────
  // UI updates instantly; GitHub write happens in the background.
  // On failure the optimistic state is cleared (rollback).

  const handleAssign = useCallback(async (slotId: string, userId: string | undefined) => {
    // If the previous occupant was a temporary user and is being replaced/removed → delete them
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
      await saveDisplay({ ...display, slots: newSlots })
      if (shouldDelete && prevUserId) await FB.deleteUser(prevUserId)
    } catch (err) {
      alert(`Fehler beim Zuweisen: ${(err as Error).message}`)
    } finally {
      setOptimisticSlots(null)
    }
  }, [display, users, saveDisplay])

  // ── Quick-add user ─────────────────────────────────────────
  // Creates a minimal User (name only, no photo) and immediately assigns them.
  // The new user appears in the Users tab and can be completed later.

  const handleQuickAdd = useCallback(async (slotId: string, name: string, temporary = false) => {
    const id = 'user-' + Date.now().toString(36)
    await FB.saveUser({ id, displayName: name, fullName: name, active: true, temporary, createdAt: new Date().toISOString() })
    const newSlots = display.slots.map((s) => {
      if (s.id !== slotId) return s
      const { userId: _removed, ...rest } = s
      return { ...rest, userId: id }
    })
    setOptimisticSlots(newSlots)
    try {
      await saveDisplay({ ...display, slots: newSlots })
    } catch (err) {
      setOptimisticSlots(null)
      alert(`Fehler: ${(err as Error).message}`)
    } finally {
      setOptimisticSlots(null)
    }
  }, [display, saveDisplay])

  // ── Slot rename (via prompt – simple and clear) ────────────

  const handleRenameSlot = useCallback(async (slotId: string, currentName: string) => {
    const newName = prompt('Neuer Slot-Name:', currentName)
    if (!newName?.trim() || newName.trim() === currentName) return
    setSavingSlot(slotId)
    try {
      await saveDisplay({
        ...display,
        slots: display.slots.map((s) => s.id === slotId ? { ...s, name: newName.trim() } : s),
      })
    } catch (err) {
      alert(`Fehler beim Umbenennen: ${(err as Error).message}`)
    } finally {
      setSavingSlot(null)
    }
  }, [display, saveDisplay])

  // ── Slot delete ────────────────────────────────────────────

  const handleDeleteSlot = useCallback(async (slotId: string, slotName: string) => {
    if (!confirm(`Slot „${slotName}" wirklich löschen?`)) return
    setSavingSlot(slotId)
    try {
      await saveDisplay({
        ...display,
        slots: display.slots.filter((s) => s.id !== slotId),
      })
    } catch (err) {
      alert(`Fehler beim Löschen: ${(err as Error).message}`)
    } finally {
      setSavingSlot(null)
    }
  }, [display, saveDisplay])

  // ── Clear all slot assignments ─────────────────────────────

  const handleClearAllSlots = useCallback(async () => {
    const assigned = currentSlots.filter((s) => s.userId)
    if (assigned.length === 0) { alert('Alle Slots sind bereits leer.'); return }
    if (!confirm(`Alle ${assigned.length} Zuweisung${assigned.length !== 1 ? 'en' : ''} aufheben?`)) return
    // Destructure userId out so the key is absent entirely — Firebase rejects undefined values.
    const cleared = display.slots.map(({ userId: _removed, ...rest }) => rest)
    setOptimisticSlots(cleared)
    setClearingAll(true)
    try {
      await saveDisplay({ ...display, slots: cleared })
    } catch (err) {
      setOptimisticSlots(null)
      alert(`Fehler: ${(err as Error).message}`)
    } finally {
      setClearingAll(false)
      setOptimisticSlots(null)
    }
  }, [display, currentSlots, saveDisplay])

  // ── Add slot ───────────────────────────────────────────────

  const addSlot = async () => {
    const name = prompt('Slot-Name (z. B. Prediger, Vox 1):')
    if (!name?.trim()) return
    const newSlot: Slot = { id: generateSlotId(), name: name.trim(), order: display.slots.length }
    try {
      await saveDisplay({ ...display, slots: [...display.slots, newSlot] })
    } catch (err) {
      alert(`Fehler: ${(err as Error).message}`)
    }
  }

  // ── Display rename ─────────────────────────────────────────

  const handleRenameDisplay = async (newName: string) => {
    setEditingDisplayName(false)
    try {
      await saveDisplay({ ...display, name: newName })
    } catch (err) {
      alert(`Fehler beim Umbenennen: ${(err as Error).message}`)
    }
  }

  // ── Display delete ─────────────────────────────────────────

  const handleDeleteDisplay = async () => {
    if (!confirm(`Display „${display.name}" wirklich löschen?\nAlle Slots und Zuweisungen gehen verloren.`)) return
    setDeleting(true)
    try {
      await FB.deleteDisplay(display.id)
      onDeleted?.(display.id)
    } catch (err) {
      alert(`Fehler beim Löschen: ${(err as Error).message}`)
      setDeleting(false)
    }
  }

  // ── Aspect ratio ───────────────────────────────────────────

  const handleSetAspectRatio = useCallback(async (ar: DisplayAspectRatio) => {
    try {
      await saveDisplay({ ...display, aspectRatio: ar })
    } catch (err) {
      alert(`Fehler: ${(err as Error).message}`)
    }
  }, [display, saveDisplay])

  // ── Refresh ────────────────────────────────────────────────

  const refresh = async () => {
    setRefreshing(true)
    try { await onUpdated() } finally { setRefreshing(false) }
  }

  const displayUrl = `${basePath}#/display/${display.id}`
  const assignedCount = currentSlots.filter((s) => s.userId).length

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0 gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {editingDisplayName ? (
            <InlineEditor
              value={display.name}
              placeholder="Display-Name"
              onSave={handleRenameDisplay}
              onCancel={() => setEditingDisplayName(false)}
            />
          ) : (
            <>
              <h2 className="text-lg font-bold text-white truncate">{display.name}</h2>
              {display.description && (
                <p className="text-sm text-white/40 truncate hidden sm:block">{display.description}</p>
              )}
              <button
                onClick={() => setEditingDisplayName(true)}
                className="p-1 rounded text-white/25 hover:text-white/70 hover:bg-white/5 transition-colors shrink-0"
                title="Display umbenennen"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">

          {/* Aspect ratio selector */}
          <div className="flex items-center gap-1 bg-surface-700 rounded-lg p-1" title="Bildschirmformat">
            <Monitor className="w-3.5 h-3.5 text-white/25 ml-1 shrink-0" />
            {ASPECT_RATIO_OPTIONS.map((ar) => (
              <button
                key={ar}
                onClick={() => handleSetAspectRatio(ar)}
                className={clsx(
                  'px-2 py-1 rounded-md text-[11px] font-semibold transition-colors',
                  display.aspectRatio === ar
                    ? 'bg-brand-600 text-white'
                    : 'text-white/35 hover:text-white/70 hover:bg-white/5',
                )}
                title={`Bildschirmformat ${ar}`}
              >
                {ar}
              </button>
            ))}
          </div>

          {/* Clear all assignments */}
          {assignedCount > 0 && (
            <button
              onClick={handleClearAllSlots}
              disabled={clearingAll}
              title="Alle Zuweisungen aufheben"
              className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg bg-surface-700 text-white/40 hover:bg-amber-500/10 hover:text-amber-400 hover:border-amber-500/30 border border-transparent transition-colors disabled:opacity-40 text-xs font-medium"
            >
              {clearingAll
                ? <div className="w-3.5 h-3.5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                : <UserX className="w-3.5 h-3.5" />
              }
              <span className="hidden sm:inline">Alle leeren</span>
            </button>
          )}

          <button onClick={refresh} disabled={refreshing}
            className="p-2 rounded-lg bg-surface-700 text-white/50 hover:bg-surface-600 hover:text-white transition-colors disabled:opacity-40"
            title="Aktualisieren">
            <RefreshCw className={clsx('w-4 h-4', refreshing && 'animate-spin')} />
          </button>

          <a href={displayUrl} target="_blank" rel="noreferrer"
            className="p-2 rounded-lg bg-surface-700 text-white/50 hover:bg-surface-600 hover:text-white transition-colors"
            title="Display öffnen">
            <ExternalLink className="w-4 h-4" />
          </a>

          <button onClick={addSlot}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-sm transition-colors">
            <Plus className="w-4 h-4" />
            Slot
          </button>

          <button
            onClick={handleDeleteDisplay}
            disabled={deleting}
            className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400/80 hover:bg-red-500/20 hover:text-red-400 transition-colors disabled:opacity-40"
            title="Display löschen"
          >
            {deleting
              ? <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
              : <Trash2 className="w-4 h-4" />
            }
          </button>
        </div>
      </div>

      {/* ── Slots ── */}
      <div className="flex-1 overflow-y-auto p-5">
        {sortedSlots.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-4 border-2 border-dashed border-white/10 rounded-2xl">
            <p className="text-white/40 text-sm">Noch keine Slots</p>
            <button onClick={addSlot}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-sm transition-colors">
              <Plus className="w-4 h-4" />
              Ersten Slot anlegen
            </button>
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-1">
            {sortedSlots.map((slot) => (
              <div key={slot.id} className="flex flex-col gap-1.5 flex-1" style={{ minWidth: 130 }}>

                {/* Slot label row */}
                <div className="flex items-center gap-1 min-h-[24px]">
                  <span className="text-xs text-white/60 font-semibold uppercase tracking-wider truncate flex-1">
                    {slot.name}
                  </span>
                  <button
                    onClick={() => handleRenameSlot(slot.id, slot.name)}
                    disabled={!!savingSlot}
                    className="p-1 rounded text-white/25 hover:text-white/70 hover:bg-white/5 transition-colors disabled:opacity-40"
                    title="Umbenennen"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => handleDeleteSlot(slot.id, slot.name)}
                    disabled={!!savingSlot}
                    className="p-1 rounded text-white/25 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40"
                    title="Löschen"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>

                {/* Assignment tile */}
                <div className="h-44">
                  <SlotAssignment
                    slot={slot}
                    users={users}
                    cfg={cfg}
                    onAssign={handleAssign}
                    onQuickAdd={handleQuickAdd}
                    saving={savingSlot === slot.id}
                  />
                </div>
              </div>
            ))}

            {/* Add slot tile */}
            <div className="flex flex-col gap-1.5 flex-1" style={{ minWidth: 130 }}>
              <div className="min-h-[24px]" />
              <button
                onClick={addSlot}
                className="h-44 flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-white/10 hover:border-brand-500/40 hover:bg-brand-500/5 transition-all group"
              >
                <Plus className="w-5 h-5 text-white/20 group-hover:text-brand-400 transition-colors" />
                <span className="text-xs text-white/20 group-hover:text-brand-400 transition-colors font-medium">
                  Slot hinzufügen
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
