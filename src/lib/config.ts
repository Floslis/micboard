// ─────────────────────────────────────────────────────────────
// MicBoard – Laufzeit-Einstellungen. Es gibt keine Geheimnisse mehr
// beim Bauen: Passwort und Daten liegen auf dem eigenen Server.
// ─────────────────────────────────────────────────────────────

import { needsSetup } from './api'

/** Ordner, in dem die App liegt (für Display-Links), z. B. „/“ oder „/micboard/“ */
export function basePath(): string {
  return window.location.pathname.replace(/[^/]*$/, '')
}

export function isConfigured(): boolean {
  return !needsSetup()
}
