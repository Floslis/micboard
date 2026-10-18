// ─────────────────────────────────────────────────────────────
// MicBoard – DisplayView
// Real-time display via Firebase onValue listener.
// Slot assignments appear within ~100 ms on all connected tabs.
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, memo } from 'react'
import type { User, Display } from '../../types'
import type { BildConfig } from '../../lib/bilder'
import * as FB from '../../lib/api'
import SlotCard from './SlotCard'

interface Props {
  displayId:     string
  cfg:           BildConfig   // Still needed for image reading
  showClock?:    boolean
  pollInterval?: number         // Kept for API compat; unused (Firebase is real-time)
}

// Clock rendered separately so it doesn't cause slot re-renders
const Clock = memo(function Clock() {
  const [time, setTime] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return (
    <span className="text-white/40 text-sm font-mono tabular-nums">
      {time.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
    </span>
  )
})

export default function DisplayView({ displayId, cfg, showClock = true }: Props) {
  const [display,     setDisplay]     = useState<Display | null>(null)
  const [users,       setUsers]       = useState<Map<string, User>>(new Map())
  const [error,       setError]       = useState<string | null>(null)
  const [isFirstLoad, setIsFirstLoad] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  // ── Subscribe to display changes (Firebase real-time) ────────
  useEffect(() => {
    if (!displayId) return
    const unsub = FB.onDisplayChange(displayId, (d) => {
      if (!d) {
        setError(`Display "${displayId}" nicht gefunden.`)
        setIsFirstLoad(false)
        return
      }
      setDisplay(d)
      setError(null)
      setIsFirstLoad(false)
      setLastUpdated(new Date())
    })
    return unsub
  }, [displayId])

  // ── Subscribe to user changes (Firebase real-time) ───────────
  useEffect(() => {
    const unsub = FB.onUsersChange((allUsers) => {
      const map = new Map<string, User>()
      allUsers.forEach((u) => map.set(u.id, u))
      setUsers(map)
    })
    return unsub
  }, [])

  const sortedSlots = display?.slots.slice().sort((a, b) => a.order - b.order) ?? []
  const slotCount   = sortedSlots.length
  const gap         = display?.slotGap ?? 12
  const slotWidth   = display?.slotWidth

  const gridCols = slotWidth
    ? `repeat(auto-fill, ${slotWidth}px)`
    : `repeat(${Math.max(slotCount, 1)}, 1fr)`

  // ── Loading ──────────────────────────────────────────────────

  if (isFirstLoad) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-surface-900 gap-4">
        <div className="w-10 h-10 rounded-full border-2 border-surface-500 border-t-brand-500 animate-spin" />
        <p className="text-white/30 text-sm">Lade Display …</p>
      </div>
    )
  }

  if (error && !display) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-surface-900">
        <div className="text-center space-y-2">
          <p className="text-2xl text-red-400/60">&#9888;</p>
          <p className="text-white/50 text-sm">{error}</p>
          <p className="text-white/25 text-xs">Display-ID: {displayId}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-full flex flex-col bg-surface-900 overflow-hidden">

      {/* Thin header bar */}
      <header className="flex items-center justify-between px-4 shrink-0" style={{ height: 40 }}>
        <span className="text-white/50 text-xs font-semibold tracking-wide truncate">
          {display?.name ?? displayId}
        </span>
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" title="Live" />
          {lastUpdated && (
            <span className="text-white/25 text-xs tabular-nums">
              {lastUpdated.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
          {showClock && <Clock />}
        </div>
      </header>

      {/* Slot grid fills everything below header */}
      <div className="flex-1 min-h-0 overflow-hidden" style={{ padding: gap }}>
        <div
          className="h-full"
          style={{ display: 'grid', gridTemplateColumns: gridCols, gap }}
        >
          {sortedSlots.map((slot) => (
            <SlotCard
              key={slot.id}
              slot={slot}
              user={slot.userId ? users.get(slot.userId) : undefined}
              cfg={cfg}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
