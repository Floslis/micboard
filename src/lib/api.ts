// ─────────────────────────────────────────────────────────────
// MicBoard – Datenschicht für den eigenen Server
// (api/index.php auf dem Webspace oder server.mjs auf Pi/Desktop).
// Gleiche Funktionen wie früher firebase.ts, damit die Oberfläche
// unverändert bleibt. Live-Abgleich: jede Sekunde nach der Revision
// fragen, nur bei Änderung kommt der ganze Stand.
// ─────────────────────────────────────────────────────────────

import type { User, Display, AppSettings } from '../types'

const API = 'api/'
const TOKEN_KEY = 'micboard_token'
const TAKT_SICHTBAR = 1000
const TAKT_VERSTECKT = 5000

interface Stand {
  rev: number
  users: Record<string, User>
  displays: Record<string, Display>
  config: { roles: string[]; settings: Partial<AppSettings> }
  setup: boolean
  demo: boolean
}

let stand: Stand | null = null
const hoerer = new Set<(s: Stand) => void>()

// ── Anmeldung ────────────────────────────────────────────────

export function getToken(): string {
  try { return localStorage.getItem(TOKEN_KEY) ?? '' } catch { return '' }
}
function setToken(t: string) {
  try { if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY) } catch { /* ignore */ }
}

async function anfrage<T>(r: string, method = 'GET', body?: unknown): Promise<T> {
  const headers: Record<string, string> = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const t = getToken()
  if (t) headers.Authorization = `Bearer ${t}`
  const res = await fetch(`${API}?r=${r}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), cache: 'no-store' })
  const daten = await res.json().catch(() => ({})) as { error?: string }
  if (res.status === 401 && r !== 'login') { setToken(''); window.dispatchEvent(new Event('micboard-abgemeldet')) }
  if (!res.ok) throw new Error(daten.error ?? `HTTP ${res.status}`)
  return daten as T
}

export async function setupPassword(password: string): Promise<void> {
  const { token } = await anfrage<{ token: string }>('setup', 'POST', { password })
  setToken(token)
  // Die Revision ändert sich beim Einrichten nicht, darum den ganzen Stand neu holen
  verteilen(await anfrage<Stand>('state'))
}
export async function login(password: string): Promise<void> {
  const { token } = await anfrage<{ token: string }>('login', 'POST', { password })
  setToken(token)
}
export async function logout(): Promise<void> {
  await anfrage('logout', 'POST').catch(() => {})
  setToken('')
}
export async function changePassword(oldPw: string, newPw: string): Promise<void> {
  const { token } = await anfrage<{ token: string }>('password', 'POST', { old: oldPw, new: newPw })
  setToken(token)
}

// Kompatibel zu den alten Aufrufen
export const signInAdmin = async () => {}
export const signOutAdmin = logout

// ── Stand holen und verteilen ────────────────────────────────

function verteilen(s: Stand) {
  stand = s
  hoerer.forEach((h) => h(s))
}

/** Einmal beim Start: holt den Stand (für Ersteinrichtung und Demo-Hinweis). */
export async function boot(): Promise<Stand> {
  const s = await anfrage<Stand>('state')
  verteilen(s)
  starten()
  return s
}
export function needsSetup(): boolean { return !!stand?.setup }
export function isDemo(): boolean { return !!stand?.demo }

async function neuLaden(): Promise<void> {
  const r = stand ? `state&rev=${stand.rev}` : 'state'
  const s = await anfrage<Stand & { unchanged?: boolean }>(r)
  if (!s.unchanged) verteilen(s)
}

let laeuft = false
function starten() {
  if (laeuft) return
  laeuft = true
  const runde = async () => {
    try { await neuLaden() } catch { /* Netz weg: nächste Runde versucht es wieder */ }
    setTimeout(runde, document.hidden ? TAKT_VERSTECKT : TAKT_SICHTBAR)
  }
  setTimeout(runde, TAKT_SICHTBAR)
  // Beim Zurückkommen auf den Tab sofort abgleichen
  document.addEventListener('visibilitychange', () => { if (!document.hidden) neuLaden().catch(() => {}) })
}

function abonnieren(fn: (s: Stand) => void): () => void {
  hoerer.add(fn)
  if (stand) fn(stand)
  else boot().catch(() => {})
  return () => { hoerer.delete(fn) }
}

/** Nach dem eigenen Schreiben: Stand lokal sofort anpassen (optimistisch), Server bestätigt in der nächsten Runde. */
function lokal(fn: (s: Stand) => void) {
  if (!stand) return
  const kopie: Stand = JSON.parse(JSON.stringify(stand))
  fn(kopie)
  verteilen(kopie)
}

function sanitize<T>(obj: T): T { return JSON.parse(JSON.stringify(obj)) as T }
const liste = <T,>(o: Record<string, T> | undefined): T[] => Object.values(o ?? {})

// ── Users ────────────────────────────────────────────────────

export async function saveUser(user: User): Promise<void> {
  const updated = sanitize({ ...user, updatedAt: new Date().toISOString() })
  lokal((s) => { s.users = { ...s.users, [user.id]: updated } })
  await anfrage(`users/${encodeURIComponent(user.id)}`, 'PUT', updated)
}
export async function deleteUser(id: string): Promise<void> {
  lokal((s) => { const u = { ...s.users }; delete u[id]; s.users = u })
  await anfrage(`users/${encodeURIComponent(id)}`, 'DELETE')
}
export async function listUsers(): Promise<User[]> {
  if (!stand) await boot()
  return liste(stand?.users)
}
export function onUsersChange(callback: (users: User[]) => void): () => void {
  return abonnieren((s) => callback(liste(s.users)))
}

// ── Displays ─────────────────────────────────────────────────

export async function saveDisplay(display: Display): Promise<void> {
  const updated = sanitize({ ...display, updatedAt: new Date().toISOString() })
  lokal((s) => { s.displays = { ...s.displays, [display.id]: updated } })
  await anfrage(`displays/${encodeURIComponent(display.id)}`, 'PUT', updated)
}
export async function deleteDisplay(id: string): Promise<void> {
  lokal((s) => { const d = { ...s.displays }; delete d[id]; s.displays = d })
  await anfrage(`displays/${encodeURIComponent(id)}`, 'DELETE')
}
export async function listDisplays(): Promise<Display[]> {
  if (!stand) await boot()
  return liste(stand?.displays)
}
export function onDisplayChange(id: string, callback: (display: Display | null) => void): () => void {
  return abonnieren((s) => callback(s.displays?.[id] ?? null))
}
export function onDisplaysChange(callback: (displays: Display[]) => void): () => void {
  return abonnieren((s) => callback(liste(s.displays)))
}

// ── Roles ────────────────────────────────────────────────────

export async function loadRoles(): Promise<string[]> {
  if (!stand) await boot()
  return stand?.config?.roles ?? []
}
export async function saveRoles(roles: string[]): Promise<void> {
  lokal((s) => { s.config = { ...s.config, roles } })
  await anfrage('roles', 'PUT', roles)
}
export function onRolesChange(callback: (roles: string[]) => void): () => void {
  return abonnieren((s) => callback(Array.isArray(s.config?.roles) ? s.config.roles : []))
}

// ── Settings ─────────────────────────────────────────────────

const DEFAULT_SETTINGS: AppSettings = {
  pollInterval: 1000,
  theme: 'dark',
  appTitle: 'MicBoard',
  showClock: true,
  animateTransitions: true,
  defaultLayout: 'grid',
}

export async function getSettings(): Promise<AppSettings> {
  if (!stand) await boot()
  return { ...DEFAULT_SETTINGS, ...(stand?.config?.settings ?? {}) }
}
export async function saveSettings(settings: AppSettings): Promise<void> {
  const updated = sanitize({ ...settings, updatedAt: new Date().toISOString() })
  lokal((s) => { s.config = { ...s.config, settings: updated } })
  await anfrage('settings', 'PUT', updated)
}
export function onSettingsChange(callback: (s: AppSettings) => void): () => void {
  return abonnieren((s) => callback({ ...DEFAULT_SETTINGS, ...(s.config?.settings ?? {}) }))
}

/** Früher: Grundeinstellungen in Firebase anlegen. Der Server legt alles selbst an. */
export async function initIfEmpty(): Promise<void> {}

// ── Bilder ───────────────────────────────────────────────────

/** Bild hochladen (Base64 ohne „data:“-Vorspann). Pfad wie „images/user-abc.webp“. */
export async function uploadImage(path: string, base64: string): Promise<void> {
  await anfrage('image', 'POST', { path, data: base64 })
}

/** Öffentliche Adresse eines Bildes. Jeder Upload bekommt einen neuen Dateinamen, darum braucht es keinen Cache-Trick. */
export function imageUrl(path: string | undefined | null): string {
  return path ?? ''
}
