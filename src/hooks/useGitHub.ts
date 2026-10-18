// ─────────────────────────────────────────────────────────────
// MicBoard – Bild-Konfiguration (früher GitHub-Zugang).
// Liefert ein festes Objekt, Bilder kommen vom eigenen Server.
// ─────────────────────────────────────────────────────────────

import { BILD_CFG, type BildConfig } from '../lib/bilder'

export function useBildConfig(): BildConfig {
  return BILD_CFG
}
