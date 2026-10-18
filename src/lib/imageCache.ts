// ─────────────────────────────────────────────────────────────
// MicBoard – Bildadressen. Früher ein Cache für die GitHub-API,
// heute liefert der eigene Server die Bilder direkt aus.
// ─────────────────────────────────────────────────────────────

import type { BildConfig } from './bilder'
import { imageUrl } from './api'

export function getAuthImageUrl(_cfg: BildConfig, imagePath: string): Promise<string> {
  return Promise.resolve(imageUrl(imagePath))
}

/** Nicht mehr nötig: jeder Upload bekommt einen neuen Dateinamen */
export function invalidateAuthImage(_cfg: BildConfig, _imagePath: string): void {}
