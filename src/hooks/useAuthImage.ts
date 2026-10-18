// ─────────────────────────────────────────────────────────────
// MicBoard – useAuthImage: Adresse eines Fotos vom eigenen Server.
// Gibt '' zurück, wenn kein Bild gesetzt ist.
// ─────────────────────────────────────────────────────────────

import type { BildConfig } from '../lib/bilder'
import { imageUrl } from '../lib/api'

export function useAuthImage(cfg: BildConfig | null, imagePath: string | null | undefined): string {
  return cfg && imagePath ? imageUrl(imagePath) : ''
}
